# Actionize

A small library to help build [Redux](http://redux.js.org/) reducers and their associated actions.

## Basics

Actionize exposes several functions to help in creating reducers and dispatching actions.

- [`reducer`](#reducer)
- [`dispatcher`](#dispatch-handler)
- [`handle`](#handle-external-actions)
- [`combine`](#combine-reducers)
- [`nest`](#nest-reducers)

### Reducer

Actionize exposes a `reducer` function to allow easy construction of reducers/actions
in one location without using switch statements:

Each action is a **function**, taking the current state and the action object.

```js
import { reducer } from 'actionize';

const todoList = reducer('todos.list', [], {

	// An action:
	// Takes the current state and arguments, and returns the new state.
	add(state, { text }) {
		return [
			...state,
			{ id: state.length + 1, text: text, done: false }
		];
	},

	complete(state, { id }) {
		return state.map(value => value.id === id
			? Object.assign({}, value, { done: true })
			: value
		);
	}
});
```

**`reducer(namespace, initialState, actions)`**

|Argument||
|:---|:---|
|`namespace`|A string namespace for the reducer. Mainly for debugging and inspection purposes.|
|`initialState`|The initial state for the reducer.|
|`actions`|An object containing functions for each action the reducer exposes.|

The `reducer` function returns a reducer with the same signature that Redux expects:
`(state, action) => newState`. It can be used directly with other Redux or with other reducers.

The action handlers are exposed on the reducer and can be called directly; for example:

`todoList.add(state, { text: 'foo' })`.

Global action types are generated based on the namespace and action keys (in the above example, `|todos.list:add` and `|todos.list:complete`).
They can be referenced through `todoList.add.type` and `todoList.complete.type`, respectively.

### Reducer Composition

Because the action handlers are exposed directly, it makes reducer composition easier:

```js
const todoList = reducer('todos.list', [], {
	// ...
	edit(state, { id, todo }) {
		return state.map(value => {
			if (value.id === id) {

				// Call another reducer action.
				return todoItem.edit(value, todo);

			}
			return value;
		});
	}
});

const todoItem = reducer('todos.item', null, {
	edit(state, { text, done }) {
		return {
			text: text || state.text || '',
			done: done || state.done || false
		};
	}
});
```

## Dispatching Actions

Dispatching actions can be done in a very basic way by creating an action object and using Redux's
[dispatch](http://redux.js.org/docs/api/Store.html#dispatch) function:

```js
store.dispatch({
	type: todoList.edit.type,
	id: 123,
	todo: { text: 'foo' }
});
```

### Dispatch Handler

A better way is to use the built-in Actionize `dispatcher` to create a dispatch handler, passing the
reducer and the Redux store's dispatch function.

**`dispatcher(actions, reduxStoreDispatch)`**

|Argument||
|:---|:---|
|`actions`|An object or reducer containing actions. See below for various combinations.|
|`reduxStoreDispatch`|The Redux dispatch function from a store.|

```js
import { dispatcher } from 'actionize';

const todoListActions = dispatcher(todoList, store.dispatch);

todoListActions.edit({
	id: 123,
	todo: { text: 'foo' }
});
```

### Custom Dispatch Handler

You can also create a custom dispatcher by simply passing a custom object as the first argument with
each item being an action handler:

```js
import { dispatcher } from 'actionize';

const todoListActions = dispatcher({
	todoList.edit,
	todoList.remove,
	otherReducer.doSomething,
	...
}, store.dispatch);

todoListActions.edit({
	id: 123,
	todo: { text: 'foo' }
});
```

The values can also be nested:

```js
import { dispatcher } from 'actionize';

const myDispatcher = dispatcher({
	todoList: todoListReducer,
	otherActions: {
		doSomething: otherReducer.doSomething
	},
	...
}, store.dispatch);

myDispatcher.todoList.edit({
	id: 123,
	todo: { text: 'foo' }
});

myDispatcher.otherActions.doSomething({ ... });
```

## Handle External Actions

There may be cases where you'd like a reducer to listen for an action defined in another.
Actionize exposes a `handle` function to wire an action handler for external/multiple actions.

```js
import { reducer, handle } from 'actionize';

const app = reducer('app', {}, {
	userLoggedIn(state, { username }) {
		// ...
	}
});

// Handle an action from another reducer.
const todoList = reducer('todos.list', [], {
	[handle(app.userLoggedIn)](state, { username }) {
		// Fetch user todos...
	}
});
```

You can also setup an action handler for a whole reducer, or multiple actions:

```js
// Handle multiple specific actions.
const todoList = reducer('todos.list', [], {

	// ...

	[handle(app.userLoggedIn, app.userLoggedOut)](state, { username }) {
		// Do something.
	}
});

// Handle all actions defined in another reducer.
const todoList = reducer('todos.list', [], {

	// ...

	[handle(app)](state, action) {
		// Do something.
	}
});
```

## Combine Reducers

Actionize exposes a `combine` function to combine reducers similar to Redux's
[`combineReducers`](http://redux.js.org/docs/api/combineReducers.html) except it provides a way to change how
the results are combined:

**`combine(reducers, pick, join)`**

|Argument||
|:---|:---|
|`reducers`|A mapping of the reducers to join by key; for example:`{ foo: fooReducer, ... }`|
|<code>pick(state,&nbsp;key)</code>|Returns the value of the given key from the current state.|
|<code>join(state,&nbsp;values)</code>|Join all of the given values for the final result.|

Example:

```js
import { reducer, combine } from 'actionize';
const foo = reducer(...);
const bar = reducer(...);
const combinedReducer = combine({ foo, bar }, pick, join);
```

### Combine Reducers (Plain JS Object)

An implementation is provided for combining results into a plain JS object:

**`combine.plain(reducers)`**

Which is the same as writing:
```js
combine(
	reducers,
	(state, key) => state && state[key],
	(state, values) => values
);
```

For example, `combine.plain({ foo, bar });` would combine `foo` and `bar` reducers into one
reducer that returns a plain JS object containing properties `foo` and `bar` with values being their
respective reducer-generated states.

### Combine Reducers (Immutable JS Structure)

An implementation is provided for combining results into an
[Immutable](https://facebook.github.io/immutable-js/) structure:

**`combine.immutable(reducers, structure)`**

An Immutable `structure` must be provided; for example:

**`combine.immutable(reducers, Immutable.Map)`**

Which is the same as writing:
```js
combine(
	reducers,
	(state, key) => state && state.get(key),
	(state, values) => Immutable.Map(values)
);
```

The implementation uses `get` to pick the values and the given `structure` to join them.

For example, `combine.immutable({ foo, bar }, Immutable.Map);` would combine `foo` and `bar` reducers into one
reducer that returns an [Immutable Map](https://facebook.github.io/immutable-js/docs/#/Map) containing keys
`foo` and `bar` with values being their respective reducer-generated states.

## Nest Reducers

Actionize exposes a `nest` function to combine reducer results _underneath_ of another reducer's results.


**`nest(parent, reducers, pick, join)`**

|Argument||
|:---|:---|
|`parent`|The parent reducer that generates the main state.|
|`reducers`|A mapping of the reducers which generate values to nest under the parent; for example:`{ foo: fooReducer, ... }`|
|<code>pick(parentState,&nbsp;key)</code>|Returns the value of the given key from the given parent state.|
|<code>join(parentState,&nbsp;values)</code>|Join all of the given values to the given parent state for the final result.|

Example:

```js
import { reducer, nest } from 'actionize';
const foo = reducer(...);
const bar = reducer(...);
const baz = reducer(...);
const combinedReducer = combine(foo, { bar, baz }, pick, join);
```

### Nest Reducers (Plain JS Object)

An implementation is provided for nesting results into a plain JS object:

**`nest.plain(parent, reducers)`**

Which is the same as writing:
```js
nest(
	parent,
	reducers,
	(state, key) => state && state[key],
	(state, values) => Object.assign({}, state, values)
);
```

For example, `nest.plain(foo, { bar, baz });` would combine all reducers and nest `bar` and `baz` reducer-generated
results in properties under the `foo` reducer-generated result. The `foo` result would be extended to include
properties `bar` and `baz` with values being their respective reducer-generated states.

### Nest Reducers (Immutable JS Structure)

An implementation is provided for nesting results into an
[Immutable](https://facebook.github.io/immutable-js/) structure:

**`nest.immutable(parent, reducers)`**

Which is the same as writing:
```js
nest(
	parent,
	reducers,
	(state, key) => state && state.get(key),
	(state, values) => state && state.merge(values)
);
```

The implementation uses `get` to pick the values and `merge` to join them.

For example, `nest.immutable(foo, { bar, baz });` would combine all reducers and nest `bar` and `baz` reducer-generated
results in properties under the `foo` reducer-generated result. The `foo` result would be extended to include
properties `bar` and `baz` with values being their respective reducer-generated states.
