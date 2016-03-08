export default class Actionize
{
	/**
	 * Create a new Actionize instance.
	 *
	 * @param {Function} [options.context]   A function producing the "this" context for all action handlers.
	 * @param {Object}   [options.Immutable] A reference to the Immutable library for creating immutable data structures.
	 *
	 * @return {Actionize} A new Actionize instance.
	 */
	constructor(options = {}) {
		// Options for this Actionize instance.
		this._options = options || {};
		// Map of unique action type prefixes to number of instances.
		this._actionTypeTicks = {};
		// Map of unique action types (including ticks).
		this._actionTypes = {};
	}

	/**
	 * Create a globally-unique action type string.
	 *
	 * @param {string} namespace The namespace for the action type (cannot include "|", ":", or "#").
	 * @param {string} key       The key for the action type (cannot include "|", ":", ".", or "#").
	 *
	 * @returns {string} The globally-unique action type.
	 */
	_createActionType(namespace, key) {

		if (typeof namespace !== 'string') {
			throw new Error('namespace must be a string.');
		}
		if (namespace.match(/[\#\:\|]/i)) {
			throw new Error('namespace cannot contain characters ("|", ":", "#").');
		}
		if (!key || key.match(/[\#\:\.\|]/i)) {
			throw new Error('key cannot contain characters ("|", ":", ".", "#").');
		}
		const prefix = namespace + ':' + key;
		const tick = (this._actionTypeTicks[prefix] || 0) + 1;
		this._actionTypeTicks[prefix] = tick;
		const name = '|' + prefix + (tick === 1 ? '' : '#' + tick);
		this._actionTypes[name] = true;
		return name;
	}

	/**
	 * Create a reducer.
	 *
	 * @param {string}                    namespace    The namespace of the reducer.
	 * @param {*}                         initialState The reducer's initial state.
	 * @param {Object.<string, Function>} actions      A map of action keys to handlers.
	 * For example:
	 * <pre><code>
	 * {
 *   addPropertyActionExample(state, action) {
 *     return { ...state, anotherProperty: action.value };
 *   },
 *   ...
 * }
	 * </code></pre>
	 *
	 * @returns {Function} The reducer function.
	 */
	reducer(namespace, initialState, actions) {

		const actionHandlers = {};

		const reducerFunc = (state = initialState, action) => {
			const actionType = action && action.type;
			const handlers = actionType && actionHandlers[actionType];
			if (handlers) {
				let contextFunc = null;
				if (this._options.context) {
					contextFunc = this._options.context;
				}
				handlers.forEach(handler => {
					const context = contextFunc && contextFunc(handler);
					state = handler.call(context, state, action);
				});
			}
			return state;
		};

		Object.keys(actions).forEach(key => {
			let actionTypes;
			const actionHandler = actions[key];
			if (key[0] === '|') {
				actionTypes = key.split('|').filter(key => !!key).map(key => '|' + key);
			} else {
				const actionType = this._createActionType(namespace, key);
				actionTypes = [ actionType ];
				const actionCall = (state, action) => reducerFunc(state, { ...action, type: actionType });
				actionCall.type = actionType;
				actionHandler.type = actionType;
				reducerFunc[key] = actionCall;
			}
			actionTypes.forEach(name => {
				const list = actionHandlers[name] || (actionHandlers[name] = []);
				list.push(actionHandler);
			});
		});

		reducerFunc._actionizeNamespace = namespace;
		reducerFunc._actionizeHandlers = actionHandlers;
		return reducerFunc;
	}

	/**
	 * Build a dispatcher from the given actions.
	 *
	 * @param {Object.<string, Object|Function>} actions  The actions to build a dispatcher from.
	 * @param {Function}                         dispatch The Redux store dispatch function.
	 *
	 * @returns {Object.<string, Object|Function>} A dispatcher object tree.
	 */
	dispatcher(actions, dispatch) {
		const result = {};
		Object.keys(actions).forEach(key => {
			const value = actions[key];
			const type = typeof value;
			if (type === 'function') {
				if (value._actionizeHandlers) {
					result[key] = this.dispatcher(value, dispatch);
				} else if (value.type) {
					result[key] = args => dispatch({ ...args, type: value.type });
				}
			} else if (type === 'object') {
				result[key] = this.dispatcher(value, dispatch);
			}
		});
		return result;
	}

	/**
	 * Helper for generating a action type handler string from various inputs.
	 *
	 * @param {*[]} items An array of items contains actions to handle.
	 *
	 * Can contain action handler functions, for example:
	 * <pre><code>
	 * actionize.reducer('test', {}, {
	 *   [handle(reducer2.foo, reducer3.bar)] { ... }
	 * }
	 * </code></pre>
	 *
	 * Can contain an entire reducer (to handle all of its actions) for example:
	 * <pre><code>
	 * actionize.reducer('test', {}, {
	 *   [handle(reducer2)] { ... }
	 * }
	 * </code></pre>
	 *
	 * @return {string} The combined action type string.
	 */
	handle(...items) {
		const actions = items.map(item => {
			if (typeof item === 'string') {
				return item;
			} else if (item) {
				const type = item.type;
				if (type) {
					return type;
				}
				const handlers = item._actionizeHandlers;
				if (handlers) {
					return Object.keys(handlers).join('');
				}
			}
		});
		return actions.filter(action => !!action).join('');
	}

	/**
	 * Pick a value from the given state.
	 *
	 * @callback combinePick
	 * @param {*}      state The current state.
	 * @param {string} key   The key to get.
	 */

	/**
	 * Join values together.
	 *
	 * @callback combineJoin
	 * @param {*}                  state  The current state.
	 * @param {Object.<string, *>} values The values to join.
	 */

	/**
	 * Combine reducers into a single one.
	 *
	 * @param {Object.<string, Function>} reducers The reducers to join.
	 * @param {combinePick}               pick     Pick a value from the given state for the given key.
	 * @param {combineJoin}               join     Join values together.
	 *
	 * @returns {Function} The combined reducer.
	 */
	combine(reducers, pick, join) {
		const reducerKeys = Object.keys(reducers);
		return function (state, action) {
			let updated = false;
			const values = {};
			reducerKeys.forEach(key => {
				const subState = pick(state, key);
				const reducer = reducers[key];
				const newState = reducer(subState, action);
				if (subState !== newState) {
					updated = true;
				}
				values[key] = newState;
			});
			if (updated) {
				state = join(state, values);
			}
			return state;
		};
	}

	/**
	 * Combine the given reducers into one that produces a plain JS object.
	 *
	 * @param {Object.<string, Function>} reducers The reducers to join.
	 *
	 * @returns {Function} The combined reducer. Returns values in a plain JS object by key.
	 */
	combinePlain(reducers) {
		return this.combine(
			reducers,
			(state, key) => state && state[key],
			(state, values) => values
		);
	}

	/**
	 * Combine the given reducers into one that produces an Immutable JS object.
	 *
	 * @param {Object.<string, Function>} reducers  The reducers to join.
	 * @param {Function}                  structure A function to produce the immutable JS structure.
	 * For example, Immutable.Map can be used.
	 *
	 * @returns {Function} The combined reducer. Returns values using the structure given.
	 */
	combineImmutable(reducers, structure) {
		if (!structure) {
			const Immutable = this._options.Immutable;
			if (Immutable) {
				structure = Immutable.Map;
			}
		}
		if (!structure) {
			throw new Error('actionize.combine.immutable(reducers, structure) requires an Immutable structure.');
		}
		return this.combine(
			reducers,
			(state, key) => state && state.get(key),
			(state, values) => structure(values)
		);
	}

	/**
	 * Combine reducers into a single one. Nest the given reducers under the parent.
	 *
	 * @param {Function}                  parent   The parent reducer.
	 * @param {Object.<string, Function>} reducers The reducers to nest.
	 * @param {combinePick}               pick     Pick a value from the given parent state for the given key.
	 * @param {combineJoin}               join     Join values to the parent state.
	 *
	 * @returns {Function} The combined reducer.
	 */
	nest(parent, reducers, pick, join) {
		const nestedReducer = this.combine(reducers, pick, join);
		return function (state, action) {
			const parentState = parent(state, action);
			return nestedReducer(parentState, action);
		};
	}

	/**
	 * Combine given reducers into a single one. Nest the given reducers state under the parent state by key.
	 *
	 * @param {Function}                  parent   The parent reducer.
	 * @param {Object.<string, Function>} reducers The reducers to nest.
	 *
	 * @returns {Function} The combined reducer. Returns values in a plain JS object by key.
	 */
	nestPlain(parent, reducers) {
		return this.nest(
			parent,
			reducers,
			(state, key) => state && state[key],
			(state, values) => Object.assign({}, state, values)
		);
	}

	/**
	 * Combine given reducers into a single one. Nest the given reducers state under the parent state by key.
	 * The parent state should be an Immutable structure that exposes a get and a merge method.
	 *
	 * @param {Function}                  parent   The parent reducer.
	 * @param {Object.<string, Function>} reducers The reducers to nest.
	 *
	 * @returns {Function} The combined reducer. Returns values in an Immutable structure.
	 */
	nestImmutable(parent, reducers) {
		return this.nest(
			parent,
			reducers,
			(state, key) => state && state.get(key),
			(state, values) => state && state.merge(values)
		);
	}
}
