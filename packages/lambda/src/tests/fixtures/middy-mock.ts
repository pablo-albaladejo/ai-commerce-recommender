/**
 * Mock for @middy/core used in tests.
 * This provides a passthrough wrapper that simulates the middleware chain.
 */
import type { Context } from 'aws-lambda';

export type MiddyRequest<
  TEvent = unknown,
  TResult = unknown,
  TErr extends Error = Error,
  TContext extends Context = Context,
  TInternal extends Record<string, unknown> = Record<string, unknown>,
> = {
  event: TEvent;
  context: TContext;
  response: TResult | null;
  error: TErr | null;
  internal: TInternal;
};

// Alias for compatibility with @middy/core imports
export type Request<
  TEvent = unknown,
  TResult = unknown,
  TErr extends Error = Error,
  TContext extends Context = Context,
  TInternal extends Record<string, unknown> = Record<string, unknown>,
> = MiddyRequest<TEvent, TResult, TErr, TContext, TInternal>;

export type MiddlewareObj<
  TEvent = unknown,
  TResult = unknown,
  TErr extends Error = Error,
  TContext extends Context = Context,
  TInternal extends Record<string, unknown> = Record<string, unknown>,
> = {
  before?: (
    request: MiddyRequest<TEvent, TResult, TErr, TContext, TInternal>
  ) => Promise<void> | void;
  after?: (
    request: MiddyRequest<TEvent, TResult, TErr, TContext, TInternal>
  ) => Promise<void> | void;
  onError?: (
    request: MiddyRequest<TEvent, TResult, TErr, TContext, TInternal>
  ) => Promise<void> | void;
};

export type Handler<TEvent = unknown, TResult = unknown> = (
  event: TEvent,
  context: Context
) => Promise<TResult>;

export type MiddyHandler<TEvent = unknown, TResult = unknown> = Handler<
  TEvent,
  TResult
> & {
  use: (
    middleware:
      | MiddlewareObj<TEvent, TResult>
      | ((config?: unknown) => MiddlewareObj<TEvent, TResult>)
  ) => MiddyHandler<TEvent, TResult>;
};

type SimpleMiddlewareObj = {
  before?: (request: MiddyRequest) => Promise<void> | void;
  after?: (request: MiddyRequest) => Promise<void> | void;
  onError?: (request: MiddyRequest) => Promise<void> | void;
};

async function executeBeforeMiddlewares(
  middlewares: SimpleMiddlewareObj[],
  request: MiddyRequest
): Promise<void> {
  for (const middleware of middlewares) {
    if (middleware.before) {
      await middleware.before(request);
    }
  }
}

async function executeOnErrorMiddlewares(
  middlewares: SimpleMiddlewareObj[],
  request: MiddyRequest
): Promise<void> {
  for (const middleware of middlewares) {
    if (middleware.onError) {
      await middleware.onError(request);
    }
  }
}

async function executeAfterMiddlewares(
  middlewares: SimpleMiddlewareObj[],
  request: MiddyRequest
): Promise<void> {
  for (let i = middlewares.length - 1; i >= 0; i--) {
    const middleware = middlewares[i];
    if (middleware.after) {
      await middleware.after(request);
    }
  }
}

/**
 * Mock middy function that wraps a handler and allows chaining .use() calls.
 * The middleware chain is simulated by calling before/after hooks.
 */
const middy = <TEvent = unknown, TResult = unknown>(
  handler: Handler<TEvent, TResult>
): MiddyHandler<TEvent, TResult> => {
  const middlewares: SimpleMiddlewareObj[] = [];

  const wrappedHandler = async (
    event: TEvent,
    context: Context
  ): Promise<TResult> => {
    const request: MiddyRequest = {
      event,
      context,
      response: null,
      error: null,
      internal: {},
    };

    await executeBeforeMiddlewares(middlewares, request);

    try {
      request.response = await handler(
        request.event as TEvent,
        request.context
      );
    } catch (error) {
      request.error = error as Error;
      await executeOnErrorMiddlewares(middlewares, request);
      if (request.error) {
        throw request.error;
      }
    }

    await executeAfterMiddlewares(middlewares, request);

    return request.response as TResult;
  };

  const middyHandler = wrappedHandler as MiddyHandler<TEvent, TResult>;

  middyHandler.use = middleware => {
    const middlewareObj =
      typeof middleware === 'function' ? middleware() : middleware;
    middlewares.push(middlewareObj as SimpleMiddlewareObj);
    return middyHandler;
  };

  return middyHandler;
};

export default middy;
