# Actionize

A small library to help build [Redux](http://redux.js.org/) reducers and their associated actions.

  [![NPM Version][npm-image]][npm-url]
  [![NPM License][npm-license-image]][npm-url]
  [![Build][travis-image]][travis-url]
  [![Test Coverage][coveralls-image]][coveralls-url]

Actionize helps you build Redux reducers without having to write large switch statements to handle actions
or create action factories to call them. Actionize maintains a set of reducer names and ensures they are unique;
this ensures all actions have unique names for dispatching.

## Simple Example

```js
import Actionize from 'actionize';
const actionize = new Actionize();

// Create a reducer:
const todoList = actionize.define('todos.list', build => build.reducer([], {

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
}));
```

## API Reference

The Actionize API is handled through two classes, `Actionize` and `ActionizeBuild`.

The `.set` and `.define` function on the `Actionize` class are given a builder which receives an instance of `ActonizeBuild`.

### `Actionize`

#### `new Actionize`

`new Actionize(options)`

Create a new instance of actionize. The given options are:

|Option||
|:---|:---|
|`context`|A function that returns the `this` context for action handlers in the format `function(action, reducer)`|
|`Immutable`|A reference to the [Immutable JS](https://facebook.github.io/immutable-js/) library instance. This is used for `.combineImmutable` and `.nestImmutable`|

#### `.set`

`.set(string name, function(ActionizeBuild build) builder)`

Set a reducer by name. The `builder` function should return the reducer. The `name` given must be unique per instance of `Actionize`.

This function is _lazy_ and will not call `builder` until `.get` is called for the same name.

```js
actionize.set('foo', build => build.reducer({}, {
	doSomething(state, { arg }) {
		return { ...state, arg };
	}
});
```

#### `.define`

`.define(string name, function(ActionizeBuild build) builder)`

Same as `.set`, but _not lazy_. Returns the reducer from `builder` immediately.

```js
const fooReducer = actionize.define('foo', build => build.reducer(...));
```

#### `.get`

`.get(string name)`

Get a reducer by name. This will invoke the `builder` prebiously given to `.set` for the same name.
If `.get` was called previously for the same name, the same instance will be returned.

```js
actionize.set('foo', build => build.reducer(...));
// ...
const fooReducer = actionize.get('foo');
```

#### `.dispatcher`

`.dispatcher(function reducer, function reduxStoreDispatch)`

Create a dispatcher object from the given reducer and Redux dispatch store.
This will allow calling functions directly on the dispatcher without needing a reference to the redux store.

**`actionize.dispatcher(actions, reduxStoreDispatch)`**

|Argument||
|:---|:---|
|`reducer`|A reducer.|
|`reduxStoreDispatch`|The Redux `store.dispatch` function.|

```js
const todoListActions = actionize.dispatcher(todoList, store.dispatch);

todoListActions.edit({
	id: 123,
	todo: { text: 'foo' }
});
```

## License

  [MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/actionize.svg
[npm-license-image]: https://img.shields.io/npm/l/actionize.svg
[npm-url]: https://npmjs.org/package/actionize
[travis-image]: https://img.shields.io/travis/aol/actionize/master.svg
[travis-url]: https://travis-ci.org/aol/actionize
[coveralls-image]: https://img.shields.io/coveralls/aol/actionize/master.svg
[coveralls-url]: https://coveralls.io/github/aol/actionize
