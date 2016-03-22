import ActionizeBuild from './ActionizeBuild';

export default class Actionize
{
	/**
	 * Create a new Actionize instance.
	 *
	 * @param {Object} options Options for the instance.
	 */
	constructor(options) {
		this._creators = {};
		this._reducers = {};
		this._actionTypes = {};
		this._reducersReserved = [];
		this._options = options || {};
	}

	/**
	 * Define a reducer and return it immediately.
	 *
	 * @param {string}   name    The name for the reducer.
	 * @param {Function} creator The reducer creator function.
	 *
	 * @returns {Function} The reducer.
	 */
	define(name, creator) {
		this.set(name, creator);
		return this.get(name);
	}

	/**
	 * Set the reducer for the given name to the result of the creator function.
	 *
	 * @param {string}   name    The name for the reducer.
	 * @param {Function} creator The reducer creator function.
	 *
	 * @returns {void}
	 */
	set(name, creator) {
		Actionize.validateName(name);
		if (typeof creator !== 'function') {
			throw new Error('Creator given must be a function.');
		}
		if (this._creators[name]) {
			throw new Error('Name given already defined.');
		}
		this._creators[name] = creator;
	}

	/**
	 * Get the reducer previously defined with the given name.
	 *
	 * @param {string} name The name of the reducer to get..
	 *
	 * @returns {Function} The reducer.
	 */
	get(name) {
		let reducer = this._reducers[name];
		if (reducer) {
			return reducer;
		}
		const creator = this._creators[name];
		if (!creator) {
			throw new Error('Name given to actionize.get(name) is not defined.');
		}
		reducer = creator(new ActionizeBuild(name, this._options));
		if (typeof reducer !== 'function') {
			throw new Error('Creator given for "' + name + '" must return a function.');
		}
		this._reserveActionTypes(reducer);
		this._reducers[name] = reducer;
		return reducer;
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

		const processedItems = [];
		const processedResults = [];

		const dispatcherLevel = actions => {
			const result = {};
			Object.keys(actions).forEach(key => {
				const value = actions[key];
				const processedIndex = processedItems.indexOf(value);
				if (processedIndex >= 0) {
					result[key] = processedResults[processedIndex];
				} else {
					const type = typeof value;
					if (type === 'function' && value.type) {
						const invoker = args => dispatch({ ...args, type: value.type });
						result[key] = invoker;
						processedItems.push(value);
						processedResults.push(invoker)
					} else if (type === 'function' || type === 'object') {
						const nested = dispatcherLevel(value);
						if (Object.keys(nested).length) {
							result[key] = nested;
							processedItems.push(value);
							processedResults.push(nested);
						}
					}
				}
			});
			return result;
		};

		return dispatcherLevel(actions);
	}

	/**
	 * Check to make sure there are only a single instance of each action on the given reducer.
	 *
	 * @param {Function} reducer The reducer to check.
	 */
	_reserveActionTypes(reducer) {

		// Don't reserve the same reducer twice.
		const reserved = this._reducersReserved;
		if (reserved.indexOf(reducer) >= 0) {
			return;
		}

		const types = this._actionTypes;
		let reserve = false;
		Object.keys(reducer).forEach(key => {
			const item = reducer[key];
			if (typeof item === 'function') {
				const type = item.type;
				if (type) {
					if (types[type]) {
						throw new Error('Action "' + item.type + '" is defined twice.');
					}
					types[type] = true;
					reserve = true;
				} else {
					this._reserveActionTypes(item);
				}
			}
		});

		if (reserve) {
			reserved.push(reducer);
		}
	}


	/**
	 * Create an action type string.
	 *
	 * @param {string} namespace The namespace for the action type (cannot include "|", ":", or "#").
	 * @param {string} key       The key for the action type (cannot include "|", ":", ".", or "#").
	 * @private
	 *
	 * @returns {string} The action type string.
	 */
	static buildActionType(namespace, key) {
		Actionize.validateActionKey(key);
		return '|' + namespace + ':' + key;
	}

	/**
	 * Check if the name is valid.
	 *
	 * @param {string} name The name to check.
	 *
	 * @private
	 * @returns {void}
	 */
	static validateName(name) {
		if (typeof name !== 'string') {
			throw new Error('Actionize name must be a string.');
		}
		if (name.match(/[\#\:\|]/i)) {
			throw new Error('Actionize name "' + name + '" cannot contain characters ("|", ":", "#").');
		}
	}

	/**
	 * Ensure the action key is valid.
	 *
	 * @param {string} key The action key to check.
	 *
	 * @private
	 * @returns {void}
	 */
	static validateActionKey(key) {
		if (typeof key !== 'string') {
			throw new Error('key must be a string.');
		}
		if (key.match(/[\#\:\.\|]/i)) {
			throw new Error('key cannot contain characters ("|", ":", ".", "#").');
		}
	}
}
