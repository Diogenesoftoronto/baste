import {
  ACTION_STEPS, BuiltinActionType, ToolNotFoundError, createQueryManager, createStore, createStreamingParser,
  evaluate, evaluateElementProps, isReactiveAssign, resolveStateField,
  type ActionEvent, type ActionPlan, type ElementNode, type EvaluationContext, type Library, type OpenUIError,
  type ParseResult, type QueryManager, type ReactiveAssign, type Store,
} from "@openuidev/lang-core";

/**
 * A framework-free OpenUI renderer state, adapted from @openuidev/vue-lang.
 *
 * It parses (streaming) OpenUI Lang, keeps `$variables`, runs Query() and
 * Mutation() through a tool map and evaluates the tree to plain JSON, so a Qwik
 * component can render it without holding non-serialisable objects. Queries
 * may call only read tools and mutations only write tools; a program that
 * crosses that line reports an error instead of running.
 */

type RuntimeFunction = NonNullable<EvaluationContext["functions"]>[string];

export type ToolMap = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

/** A `$binding` prop after evaluation: where it writes, and what it holds now. */
export interface Binding extends ReactiveAssign {
  value: unknown;
}

export interface RuntimeSnapshot {
  root: ElementNode | null;
  errors: OpenUIError[];
  streaming: boolean;
  queryLoading: boolean;
  /** `$variables` as the person has left them. */
  state: Record<string, unknown>;
}

export interface RuntimeOptions {
  library: Library;
  tools: ToolMap;
  readTools: readonly string[];
  writeTools: readonly string[];
  /** Persisted `$variables` applied once, on the first program. */
  initialState?: Record<string, unknown>;
  onAction?: (event: ActionEvent) => void;
  onChange: (snapshot: RuntimeSnapshot) => void;
}

export function isBinding(value: unknown): value is Binding {
  return isReactiveAssign(value) && "value" in (value as object);
}

/** A prop that may be a literal or a `$binding`. */
export function boundValue<T>(value: unknown, fallback: T): T {
  const raw = isBinding(value) ? value.value : value;
  return (raw ?? fallback) as T;
}

const unwrap = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) && "value" in value ? (value as { value: unknown }).value : value;

/** Replace each ReactiveAssign with a Binding carrying the current value. */
function attachBindings(value: unknown, store: Store): unknown {
  if (isReactiveAssign(value)) return { ...value, value: unwrap(store.get(value.target)) ?? null };
  if (Array.isArray(value)) return value.map((item) => attachBindings(item, store));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = attachBindings(item, store);
    return out;
  }
  return value;
}

export class SurfaceRuntime {
  private readonly parser;
  private readonly store: Store = createStore();
  private readonly queries: QueryManager;
  private readonly unsubscribe: Array<() => void> = [];
  private readonly functions: Record<string, RuntimeFunction>;
  private result: ParseResult | null = null;
  private parseError: OpenUIError | null = null;
  private source = "";
  private streaming = false;
  private initialized = false;
  private disposed = false;

  constructor(private readonly options: RuntimeOptions) {
    const schema = options.library.toJSONSchema();
    this.parser = createStreamingParser(schema, options.library.root);
    this.functions = Object.fromEntries(Object.entries(schema.functions ?? {}).map(([name, spec]) => [name, { ...spec, fn: options.library.functions?.[name]?.fn ?? (() => null) } as RuntimeFunction]));
    const known = new Set([...options.readTools, ...options.writeTools]);
    this.queries = createQueryManager({
      callTool: (name, args) => {
        const tool = options.tools[name];
        if (!known.has(name) || !tool) throw new ToolNotFoundError(name, [...known]);
        return tool(args);
      },
    });
    this.queries.activate();
    this.unsubscribe.push(this.store.subscribe(() => this.refresh()), this.queries.subscribe(() => this.emit()));
  }

  /** Show a program, complete or still arriving. */
  setProgram(source: string, streaming = false): void {
    if (this.disposed) return;
    this.streaming = streaming;
    if (source !== this.source || !this.result) {
      this.source = source;
      this.parseError = null;
      try {
        this.result = source ? this.parser.set(source) : null;
      } catch (error) {
        this.result = null;
        this.parseError = { source: "parser", code: "parse-exception", message: `Parser crashed: ${error instanceof Error ? error.message : String(error)}` };
      }
      const defaults = this.result?.stateDeclarations ?? {};
      // A value that matches its new default (as after a save) follows later defaults again, as after an undo.
      for (const [name, value] of Object.entries(defaults)) if (Object.is(this.store.get(name), value)) this.store.set(name, value, { pristine: true });
      this.store.initialize(defaults, this.initialized ? {} : this.options.initialState ?? {});
      this.initialized = true;
    }
    this.refresh();
  }

  /** Write a value through a `$binding`. */
  assign(binding: ReactiveAssign, value: unknown): void {
    resolveStateField(binding.target, binding, this.store, this.context(), () => undefined, () => undefined).setValue(value);
  }

  /** Run a component's action: its steps in order, or a plain message to the assistant. */
  async run(plan: ActionPlan | null | undefined, label = ""): Promise<void> {
    const event = (type: string, params: Record<string, unknown>, message: string): ActionEvent =>
      ({ type, params, humanFriendlyMessage: message, formState: this.store.getSnapshot() } as ActionEvent);
    if (!plan?.steps?.length) {
      this.options.onAction?.(event(BuiltinActionType.ContinueConversation, {}, label));
      return;
    }
    for (const step of plan.steps) {
      if (this.disposed) return;
      switch (step.type) {
        case ACTION_STEPS.Run: {
          if (step.refType === "mutation") {
            const statement = this.result?.mutationStatements.find((item) => item.statementId === step.statementId);
            if (!statement || !this.allowed(statement.toolAST, this.options.writeTools)) return;
            const args = statement.argsAST ? evaluate(statement.argsAST, this.context()) : {};
            if (!(await this.queries.fireMutation(step.statementId, (args ?? {}) as Record<string, unknown>))) return;
          } else this.queries.invalidate([step.statementId]);
          break;
        }
        case ACTION_STEPS.ToAssistant:
          this.options.onAction?.(event(BuiltinActionType.ContinueConversation, step.context ? { context: step.context } : {}, step.message));
          break;
        case ACTION_STEPS.OpenUrl:
          this.options.onAction?.(event(BuiltinActionType.OpenUrl, { url: step.url }, ""));
          break;
        case ACTION_STEPS.Set:
          if (step.valueAST) this.store.set(step.target, evaluate(step.valueAST, this.context()));
          break;
        case ACTION_STEPS.Reset: {
          const defaults = this.result?.stateDeclarations ?? {};
          for (const target of step.targets) this.store.set(target, defaults[target] ?? null, { pristine: true });
          break;
        }
      }
    }
  }

  /** Re-run read queries, e.g. after the saved design changed elsewhere. */
  invalidate(): void {
    this.queries.invalidate();
  }

  dispose(): void {
    this.disposed = true;
    for (const stop of this.unsubscribe.splice(0)) stop();
    this.queries.dispose();
    this.store.dispose();
  }

  private context(): EvaluationContext {
    return {
      getState: (name) => unwrap(this.store.get(name)),
      resolveRef: (name) => this.queries.getMutationResult(name) ?? this.queries.getResult(name),
      functions: this.functions,
    };
  }

  private allowed(toolAST: unknown, names: readonly string[]): boolean {
    const name = toolAST ? evaluate(toolAST as never, this.context()) : "";
    return typeof name === "string" && names.includes(name);
  }

  private refresh(): void {
    if (this.disposed) return;
    if (!this.streaming && this.result) {
      const ctx = this.context();
      this.queries.evaluateQueries(this.result.queryStatements.filter((q) => this.allowed(q.toolAST, this.options.readTools)).map((q) => {
        const deps: Record<string, unknown> = {};
        for (const name of q.deps ?? []) deps[name] = this.store.get(name);
        return {
          statementId: q.statementId,
          toolName: q.toolAST ? evaluate(q.toolAST, ctx) as string : "",
          args: q.argsAST ? evaluate(q.argsAST, ctx) : null,
          defaults: q.defaultsAST ? evaluate(q.defaultsAST, ctx) : null,
          refreshInterval: q.refreshAST ? evaluate(q.refreshAST, ctx) as number : undefined,
          deps: Object.keys(deps).length ? deps : undefined,
          complete: q.complete,
        };
      }));
      this.queries.registerMutations(this.result.mutationStatements.filter((m) => this.allowed(m.toolAST, this.options.writeTools))
        .map((m) => ({ statementId: m.statementId, toolName: m.toolAST ? evaluate(m.toolAST, ctx) as string : "" })));
    }
    this.emit();
  }

  private emit(): void {
    if (this.disposed) return;
    const errors: OpenUIError[] = [];
    let root: ElementNode | null = null;
    if (this.parseError) errors.push(this.parseError);
    if (this.result?.root) {
      try {
        root = attachBindings(evaluateElementProps(this.result.root, { ctx: this.context(), library: this.options.library, store: this.store, errors }), this.store) as ElementNode;
      } catch (error) {
        errors.push({ source: "runtime", code: "runtime-error", message: `Prop evaluation failed: ${error instanceof Error ? error.message : String(error)}` });
      }
    } else if (this.source && !this.streaming && !this.parseError) {
      errors.push({ source: "parser", code: "parse-failed", message: "The surface has no renderable root." });
    }
    if (!this.streaming) {
      for (const error of this.result?.meta.errors ?? []) errors.push({ source: "parser", code: error.code, message: error.message, component: error.component, statementId: error.statementId });
      for (const q of this.result?.queryStatements ?? []) if (!this.allowed(q.toolAST, this.options.readTools)) errors.push({ source: "query", code: "tool-not-found", message: "Only read tools may run as a Query.", statementId: q.statementId });
      for (const m of this.result?.mutationStatements ?? []) if (!this.allowed(m.toolAST, this.options.writeTools)) errors.push({ source: "mutation", code: "tool-not-found", message: "Only write tools may run as a Mutation.", statementId: m.statementId });
      errors.push(...this.queries.getSnapshot().__openui_errors);
    }
    const snapshot = this.queries.getSnapshot();
    this.options.onChange({
      root, errors, streaming: this.streaming,
      queryLoading: snapshot.__openui_loading.length > 0,
      state: Object.fromEntries(Object.entries(this.store.getSnapshot()).filter(([key]) => key.startsWith("$"))),
    });
  }
}
