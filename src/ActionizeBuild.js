import Actionize from './Actionize';

export default class ActionizeBuild
{
	/**
	 * Create a new ActionizeBuild instance.
	 *
	 * @param {string} name    Name of the item.
	 * @param {Object} options Options for the instance.
	 */
	constructor(name, options) {
		this._name = name;
		this._options = options || {};
	}

	/**
	 * Create a reducer.
	 *
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
	reducer(initialState, actions) {

		const actionHandlers = {};

		const reducerFunc = (state = initialState, action) => {
			const actionType = action && action.type;
			const handlers = actionType && actionHandlers[actionType];
			if (handlers) {
				handlers.forEach(handler => {
					state = handler(state, action);
				});
			}
			return state;
		};

		Object.keys(actions).forEach(key => {
			const actionHandler = actions[key];
			if (typeof actionHandler === 'function' && key) {
				let actionTypes;
				const actionCall = (state, action) => {
					const contextFunc = this._options.context;
					const context = contextFunc ? contextFunc(actionHandler, reducerFunc) : null;
					return actionHandler.call(context, state, action);
				};
				if (key[0] === '|') {
					actionTypes = key.split('|').filter(key => !!key).map(key => '|' + key);
				} else {
					const actionType = Actionize.buildActionType(this._name, key);
					actionTypes = [actionType];
					actionCall.type = actionType;
					reducerFunc[key] = actionCall;
				}
				actionTypes.forEach(actionType => {
					const list = actionHandlers[actionType] || (actionHandlers[actionType] = []);
					list.push(actionCall);
				});
			}
		});

		return reducerFunc;
	}

	/**
	 * Helper for generating a action type handler string from various inputs.
	 *
	 * @param {*[]} items An array of items contains actions to handle.
	 *
	 * Can contain action handler functions, for example:
	 * <pre><code>
	 * const reducer2 = actionize.get('reducer2');
	 *
	 * build.reducer({}, {
	 *   [build.handle(reducer2.foo, reducer3.bar)] { ... }
	 * }
	 * </code></pre>
	 *
	 * Can contain an entire reducer (to handle all of its actions) for example:
	 * <pre><code>
	 * const reducer2 = actionize.get('reducer2');
	 *
	 * build.reducer('test', {}, {
	 *   [build.handle(reducer2)] { ... }
	 * }
	 * </code></pre>
	 *
	 * @return {string} The combined action type string.
	 */
	handle(...items) {
		const actions = items.map(item => {
			if (typeof item === 'string') {
				return item;
			} else if (typeof item === 'function') {
				const type = item.type;
				if (typeof type === 'string') {
					return type;
				}
				const handlerTypes = Object.keys(item)
					.map(key => item[key])
					.filter(item => typeof item === 'function' && item.type)
					.map(handler => handler.type);
				if (handlerTypes.length) {
					return handlerTypes.join('');
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
		const reducerFunc = (state, action) => {
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
		reducerKeys.forEach(key => {
			reducerFunc[key] = reducers[key];
		});
		return reducerFunc;
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
			throw new Error('combineImmutable(reducers, structure) requires an Immutable structure.');
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
		const reducerFunc = (state, action) => {
			const parentState = parent(state, action);
			return nestedReducer(parentState, action);
		};
		Object.keys(nestedReducer).forEach(key => {
			reducerFunc[key] = nestedReducer[key];
		});
		Object.keys(parent).forEach(key => {
			const action = parent[key];
			if (typeof action === 'function' && action.type) {
				reducerFunc[key] = action;
			}
		});
		return reducerFunc;
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
