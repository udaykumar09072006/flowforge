import { NodeType } from '../../types/workflow';
import { ExpressionContext, resolveExpression } from './expression';
import { validateUrlForSSRF } from './ssrf-guard';

export interface HandlerResult {
  output: any;
  branch?: string; // Used for condition/switch branching (e.g. 'true', 'false', 'caseName')
  stopBranch?: boolean; // For filter nodes that halt branch
}

export interface NodeExecutionContext {
  nodeId: string;
  config: Record<string, any>;
  expressionContext: ExpressionContext;
  incomingInputs: Record<string, any>;
  logger: (message: string, level?: 'info' | 'warn' | 'error' | 'debug') => void;
  signal?: AbortSignal;
  dbStore: {
    executeOperation: (collection: string, operation: string, payload: any) => Promise<any>;
  };
  emailService: {
    send: (to: string, subject: string, body: string) => Promise<{ id: string; status: 'delivered' | 'failed' }>;
  };
}

export type NodeExecutionHandler = (ctx: NodeExecutionContext) => Promise<HandlerResult>;

export const NODE_HANDLERS: Record<NodeType, NodeExecutionHandler> = {
  // -------------------------------------------------------------
  // TRIGGERS
  // -------------------------------------------------------------
  'trigger:manual': async (ctx) => {
    ctx.logger(`Manual Trigger invoked with payload.`);
    const payload = ctx.expressionContext.trigger || {};
    return { output: payload };
  },

  'trigger:webhook': async (ctx) => {
    ctx.logger(`Webhook Trigger received payload.`);
    const payload = ctx.expressionContext.trigger || {};
    return { output: payload };
  },

  'trigger:schedule': async (ctx) => {
    const now = new Date().toISOString();
    ctx.logger(`Schedule Trigger executed at ${now}.`);
    return {
      output: {
        timestamp: now,
        cron: ctx.config.cronExpression || '0 * * * *',
        timezone: ctx.config.timezone || 'UTC',
      },
    };
  },

  // -------------------------------------------------------------
  // LOGIC
  // -------------------------------------------------------------
  'logic:condition': async (ctx) => {
    const { field, operator = 'eq', value } = ctx.config;
    const evaluatedLeft = resolveExpression(field, ctx.expressionContext);
    const evaluatedRight = resolveExpression(value, ctx.expressionContext);

    let passed = false;

    switch (operator) {
      case 'eq':
        passed = String(evaluatedLeft) === String(evaluatedRight);
        break;
      case 'neq':
        passed = String(evaluatedLeft) !== String(evaluatedRight);
        break;
      case 'gt':
        passed = Number(evaluatedLeft) > Number(evaluatedRight);
        break;
      case 'gte':
        passed = Number(evaluatedLeft) >= Number(evaluatedRight);
        break;
      case 'lt':
        passed = Number(evaluatedLeft) < Number(evaluatedRight);
        break;
      case 'lte':
        passed = Number(evaluatedLeft) <= Number(evaluatedRight);
        break;
      case 'contains':
        passed = String(evaluatedLeft).toLowerCase().includes(String(evaluatedRight).toLowerCase());
        break;
      case 'exists':
        passed = evaluatedLeft !== undefined && evaluatedLeft !== null && evaluatedLeft !== '';
        break;
      case 'boolean':
        passed = Boolean(evaluatedLeft) && evaluatedLeft !== 'false' && evaluatedLeft !== '0';
        break;
      default:
        passed = Boolean(evaluatedLeft);
    }

    const branch = passed ? 'true' : 'false';
    ctx.logger(`Evaluated condition '${field}' ${operator} '${value}' -> Result: ${branch} (left=${JSON.stringify(evaluatedLeft)}, right=${JSON.stringify(evaluatedRight)})`);

    return {
      output: {
        fieldValue: evaluatedLeft,
        comparisonValue: evaluatedRight,
        passed,
        branch,
      },
      branch,
    };
  },

  'logic:switch': async (ctx) => {
    const { field, cases = [] } = ctx.config;
    const resolvedValue = String(resolveExpression(field, ctx.expressionContext));
    
    let branch = 'default';
    if (Array.isArray(cases) && cases.map(String).includes(resolvedValue)) {
      branch = resolvedValue;
    }

    ctx.logger(`Switch evaluated on value '${resolvedValue}' -> routing to branch '${branch}'`);
    return {
      output: { value: resolvedValue, branch },
      branch,
    };
  },

  'logic:filter': async (ctx) => {
    const { field, operator = 'eq', value } = ctx.config;
    const evaluatedLeft = resolveExpression(field, ctx.expressionContext);
    const evaluatedRight = resolveExpression(value, ctx.expressionContext);

    let passes = false;
    if (operator === 'eq') passes = String(evaluatedLeft) === String(evaluatedRight);
    else if (operator === 'gt') passes = Number(evaluatedLeft) > Number(evaluatedRight);
    else if (operator === 'lt') passes = Number(evaluatedLeft) < Number(evaluatedRight);
    else passes = Boolean(evaluatedLeft);

    ctx.logger(`Filter check: ${passes ? 'Passed, continuing branch' : 'Failed, stopping branch execution'}`);
    return {
      output: { passed: passes, value: evaluatedLeft },
      stopBranch: !passes,
    };
  },

  'logic:merge': async (ctx) => {
    ctx.logger(`Merging upstream inputs from active branches.`);
    const merged: Record<string, any> = {};
    for (const [sourceNodeId, data] of Object.entries(ctx.incomingInputs)) {
      merged[sourceNodeId] = data;
    }
    return { output: { merged, timestamp: new Date().toISOString() } };
  },

  'logic:delay': async (ctx) => {
    const rawSeconds = ctx.config.seconds || 1;
    const seconds = Math.min(Math.max(Number(rawSeconds) || 1, 0.5), 10); // cap between 0.5s and 10s for responsive UX
    ctx.logger(`Delaying execution for ${seconds} seconds...`);
    
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, seconds * 1000);
      if (ctx.signal) {
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Delay cancelled by workflow cancellation request'));
        });
      }
    });

    ctx.logger(`Delay complete.`);
    return { output: { delayedSeconds: seconds, resumedAt: new Date().toISOString() } };
  },

  // -------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------
  'action:http_request': async (ctx) => {
    const { method = 'POST', url: rawUrl, headers: rawHeaders, body: rawBody, timeoutSeconds = 10 } = ctx.config;

    const resolvedUrl = String(resolveExpression(rawUrl, ctx.expressionContext));
    
    // SSRF Validation
    const ssrfCheck = validateUrlForSSRF(resolvedUrl);
    if (!ssrfCheck.isAllowed) {
      ctx.logger(`SSRF Protection blocked URL: ${ssrfCheck.reason}`, 'error');
      throw new Error(`SSRF Block: ${ssrfCheck.reason}`);
    }

    ctx.logger(`Executing HTTP ${method} -> ${resolvedUrl}`);

    // Parse headers
    let headers: Record<string, string> = {
      'User-Agent': 'FlowForge-WorkflowEngine/1.0',
    };
    if (rawHeaders) {
      try {
        const resolvedHeaders = resolveExpression(rawHeaders, ctx.expressionContext);
        const parsed = typeof resolvedHeaders === 'string' ? JSON.parse(resolvedHeaders) : resolvedHeaders;
        headers = { ...headers, ...parsed };
      } catch (err: any) {
        ctx.logger(`Warning: Failed to parse custom headers JSON: ${err.message}`, 'warn');
      }
    }

    // Prepare body for methods with payload
    let reqBody: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      if (rawBody) {
        const resolvedBody = resolveExpression(rawBody, ctx.expressionContext);
        reqBody = typeof resolvedBody === 'string' ? resolvedBody : JSON.stringify(resolvedBody);
      }
    }

    const controller = new AbortController();
    const timeoutMs = (Number(timeoutSeconds) || 10) * 1000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Link with parent cancellation signal
    if (ctx.signal) {
      ctx.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const startTime = Date.now();
      const response = await fetch(resolvedUrl, {
        method: method.toUpperCase(),
        headers,
        body: reqBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      const status = response.status;
      const statusText = response.statusText;

      let responseData: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      ctx.logger(`HTTP Response ${status} ${statusText} received in ${duration}ms`);

      if (!response.ok) {
        ctx.logger(`HTTP request responded with non-2xx status code: ${status}`, 'warn');
      }

      return {
        output: {
          status,
          statusText,
          durationMs: duration,
          data: responseData,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`HTTP Request timed out after ${timeoutSeconds}s or cancelled.`);
      }
      ctx.logger(`HTTP Request failed: ${err.message}`, 'error');
      throw err;
    }
  },

  'action:send_email': async (ctx) => {
    const rawTo = ctx.config.to || '';
    const rawSubj = ctx.config.subject || 'Workflow Notification';
    const rawBody = ctx.config.body || '';

    const to = String(resolveExpression(rawTo, ctx.expressionContext));
    const subject = String(resolveExpression(rawSubj, ctx.expressionContext));
    const body = String(resolveExpression(rawBody, ctx.expressionContext));

    if (!to || !to.includes('@')) {
      throw new Error(`Invalid recipient email address: '${to}'`);
    }

    ctx.logger(`Dispatching email to <${to}> with subject: "${subject}"`);
    const sentRecord = await ctx.emailService.send(to, subject, body);

    return {
      output: {
        id: sentRecord.id,
        recipient: to,
        subject,
        bodyLength: body.length,
        status: sentRecord.status,
        deliveredAt: new Date().toISOString(),
      },
    };
  },

  'action:db_record': async (ctx) => {
    const { collection = 'records', operation = 'insert', payload: rawPayload } = ctx.config;

    let payload: any = {};
    if (rawPayload) {
      const resolved = resolveExpression(rawPayload, ctx.expressionContext);
      payload = typeof resolved === 'string' ? JSON.parse(resolved) : resolved;
    }

    ctx.logger(`Executing DB operation '${operation}' on collection '${collection}'`);
    const result = await ctx.dbStore.executeOperation(collection, operation, payload);

    return {
      output: {
        collection,
        operation,
        result,
      },
    };
  },

  'action:log': async (ctx) => {
    const { level = 'info', message: rawMsg } = ctx.config;
    const message = String(resolveExpression(rawMsg, ctx.expressionContext));

    ctx.logger(`[${level.toUpperCase()}] ${message}`, level as any);
    return {
      output: {
        level,
        message,
        loggedAt: new Date().toISOString(),
      },
    };
  },

  // -------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------
  'utility:set_variable': async (ctx) => {
    const { variableName, variableValue } = ctx.config;
    if (!variableName) {
      throw new Error('Variable name is required in Set Variable node.');
    }

    const resolvedVal = resolveExpression(variableValue, ctx.expressionContext);
    
    // Write into shared expressionContext variables
    if (!ctx.expressionContext.variables) {
      ctx.expressionContext.variables = {};
    }
    ctx.expressionContext.variables[variableName] = resolvedVal;

    ctx.logger(`Set workflow variable '${variableName}' = ${JSON.stringify(resolvedVal)}`);
    return {
      output: {
        name: variableName,
        value: resolvedVal,
      },
    };
  },

  'utility:transform': async (ctx) => {
    const { mapping: rawMapping } = ctx.config;
    let transformed: any = {};

    if (rawMapping) {
      try {
        const resolved = resolveExpression(rawMapping, ctx.expressionContext);
        transformed = typeof resolved === 'string' ? JSON.parse(resolved) : resolved;
      } catch (err: any) {
        throw new Error(`Failed to parse Transform Data JSON mapping: ${err.message}`);
      }
    }

    ctx.logger(`Transformed data successfully into ${Object.keys(transformed).length} fields`);
    return { output: transformed };
  },

  'utility:json_parse': async (ctx) => {
    const { sourceField } = ctx.config;
    const rawVal = resolveExpression(sourceField, ctx.expressionContext);

    if (rawVal === undefined || rawVal === null) {
      throw new Error(`JSON Parse node source field evaluated to null/undefined`);
    }

    let parsed: any;
    if (typeof rawVal === 'string') {
      try {
        parsed = JSON.parse(rawVal);
      } catch (err: any) {
        throw new Error(`Invalid JSON syntax in source field: ${err.message}`);
      }
    } else {
      parsed = rawVal;
    }

    ctx.logger(`Parsed JSON payload successfully.`);
    return { output: parsed };
  },

  'utility:string_util': async (ctx) => {
    const { inputString: rawInput, operation = 'uppercase', findText, replaceWith } = ctx.config;
    const input = String(resolveExpression(rawInput, ctx.expressionContext) || '');

    let result = input;
    switch (operation) {
      case 'uppercase':
        result = input.toUpperCase();
        break;
      case 'lowercase':
        result = input.toLowerCase();
        break;
      case 'trim':
        result = input.trim();
        break;
      case 'slugify':
        result = input
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/[\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
        break;
      case 'replace':
        if (findText) {
          result = input.replaceAll(findText, replaceWith || '');
        }
        break;
      default:
        result = input;
    }

    ctx.logger(`String operation '${operation}' on "${input}" -> "${result}"`);
    return { output: { result, original: input } };
  },

  'utility:date_util': async (ctx) => {
    const { operation = 'now', daysToAdd = 1 } = ctx.config;
    const now = new Date();

    let resultDate: Date = now;
    if (operation === 'addDays') {
      resultDate = new Date(now.getTime() + (Number(daysToAdd) || 1) * 24 * 60 * 60 * 1000);
    }

    ctx.logger(`Date utility evaluated operation '${operation}' -> ${resultDate.toISOString()}`);
    return {
      output: {
        iso: resultDate.toISOString(),
        timestamp: resultDate.getTime(),
        dateString: resultDate.toLocaleDateString(),
        timeString: resultDate.toLocaleTimeString(),
      },
    };
  },

  'utility:generate_output': async (ctx) => {
    const { outputPayload: rawPayload } = ctx.config;
    let finalOutput: any = {};

    if (rawPayload) {
      const resolved = resolveExpression(rawPayload, ctx.expressionContext);
      finalOutput = typeof resolved === 'string' ? JSON.parse(resolved) : resolved;
    }

    ctx.logger(`Generated final workflow return payload.`);
    return { output: finalOutput };
  },
};
