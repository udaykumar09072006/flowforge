/**
 * Safe expression resolver for FlowForge workflows.
 * Evaluates syntax like:
 *   {{trigger.order.amount}}
 *   {{nodes.validate.output.isValid}}
 *   {{variables.discountRate}}
 *   {{run.id}}
 * 
 * STRICT SECURITY: Does NOT use eval, Function, or vm module.
 */

export interface ExpressionContext {
  trigger?: any;
  nodes?: Record<string, { output?: any; status?: string }>;
  variables?: Record<string, any>;
  run?: { id: string; workflowId: string; startedAt: string };
  env?: Record<string, string>;
}

/**
 * Safely accesses a nested path within an object
 * e.g. "order.items[0].price" -> obj.order.items[0].price
 */
export function getNestedProperty(obj: any, path: string): any {
  if (obj === null || obj === undefined) return undefined;
  if (!path || path.trim() === '') return obj;

  // Normalize array notation: e.g. "items[0].price" -> "items.0.price"
  const normalizedPath = path
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\./, '');

  const segments = normalizedPath.split('.');
  let current = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    // Disallow prototype pollution keys
    if (segment === '__proto__' || segment === 'constructor' || segment === 'prototype') {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

/**
 * Evaluates a single token or expression string
 */
export function resolveToken(token: string, context: ExpressionContext): any {
  const trimmed = token.trim();

  // Literal primitives
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;

  // Numerical literal
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // Quoted string literal 'hello' or "hello"
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Context path resolution
  if (trimmed.startsWith('trigger.')) {
    return getNestedProperty(context.trigger, trimmed.slice('trigger.'.length));
  }
  if (trimmed === 'trigger') {
    return context.trigger;
  }

  if (trimmed.startsWith('nodes.')) {
    // e.g. nodes.node_1.output.id
    return getNestedProperty(context.nodes, trimmed.slice('nodes.'.length));
  }

  if (trimmed.startsWith('variables.')) {
    return getNestedProperty(context.variables, trimmed.slice('variables.'.length));
  }

  if (trimmed.startsWith('run.')) {
    return getNestedProperty(context.run, trimmed.slice('run.'.length));
  }

  // Fallback to top-level property check in trigger
  if (context.trigger && typeof context.trigger === 'object' && trimmed in context.trigger) {
    return context.trigger[trimmed];
  }

  return undefined;
}

/**
 * Replaces all {{expression}} occurrences in a string template,
 * or returns raw type if the entire string is just one {{expression}}.
 */
export function resolveExpression(template: any, context: ExpressionContext): any {
  if (template === null || template === undefined) return template;

  if (typeof template !== 'string') {
    if (Array.isArray(template)) {
      return template.map((item) => resolveExpression(item, context));
    }
    if (typeof template === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(template)) {
        result[key] = resolveExpression(val, context);
      }
      return result;
    }
    return template;
  }

  const trimmed = template.trim();

  // If the string is purely a single `{{expression}}`, preserve the actual resolved type (number, boolean, object)
  const singleMatch = trimmed.match(/^\{\{([^{}]+)\}\}$/);
  if (singleMatch) {
    const rawVal = resolveToken(singleMatch[1], context);
    return rawVal !== undefined ? rawVal : '';
  }

  // Otherwise, interpolate into a string
  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, expr) => {
    const val = resolveToken(expr, context);
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}
