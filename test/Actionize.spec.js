import expect from 'expect';
import Immutable from 'immutable';
import Actionize from '../src/Actionize';

describe('Actionize', () => {

	describe('set/define', () => ['set', 'define'].forEach(f => {

		it('(' + f + ') throws an error when creator is not a function', () => {
			expect(() => {
				const a = new Actionize;
				a[f]('foo', 'not-a-function');
			}).toThrow(/must be a function/i);
		});

		it('(' + f + ') throws an error when name is already set', () => {
			expect(() => {
				const a = new Actionize;
				a[f]('foo', () => () => null);
				a[f]('foo', () => () => null);
			}).toThrow(/already defined/i);
		});

		it('(' + f + ') sets a value that can be fetched with get', () => {
			const a = new Actionize;
			const result = () => null;
			a[f]('foo', () => result);
			expect(a.get('foo')).toEqual(result);
		});

		it('(' + f + ') must use strings for names', () => {
			expect(() => {
				const a = new Actionize;
				a[f](123, 'not-a-function');
			}).toThrow(/must be a string/i);
		});

		it('(' + f + ') names cannot contain reserved chars', () => {
			const chars = ['|', ':', '#'];
			chars.forEach(char => expect(() => {
				const a = new Actionize;
				a[f]('test-' + char + '-character', () => null);
			}).toThrow(/cannot contain characters/i, 'Should throw error for char "' + char + '"'));
		});

	}));

	describe('define', () => {

		it('returns the reducer immediately', () => {
			const a = new Actionize;
			const result = () => null;
			expect(a.define('foo', () => result)).toEqual(result);
		});

	});

	describe('get', () => {

		it('throws an error when name is not defined', () => {
			expect(() => {
				const a = new Actionize;
				a.get('undefined')
			}).toThrow(/not defined/i);
		});

		it('throws an error when creator does not return a function', () => {
			expect(() => {
				const a = new Actionize;
				a.set('foo', () => 'not-a-function');
				a.get('foo')
			}).toThrow(/must return a function/i);
		});

		it('returns already defined items immediately', () => {
			const a = new Actionize;
			const result = () => null;
			let called = 0;
			a.set('foo', () => {
				called++;
				return result;
			});
			expect(a.get('foo')).toEqual(result);
			expect(a.get('foo')).toEqual(result);
			expect(called).toEqual(1);
		});

		it('works with defined nested reducers', () => {
			const a = new Actionize;

			a.set('r1', build => {
				const r2 = a.get('r2');
				const r1 = build.reducer({ foo: true }, {
					setBar: (state, action) => Object.assign({}, state, { bar: action.bar }),
				});
				return build.nestPlain(r1, { r2 });
			});

			a.set('r2', build => build.reducer({ baz: true }, {
				setQux: (state, action) => Object.assign({}, state, { qux: action.qux }),
			}));

			const r1 = a.get('r1');
			expect(r1).toBeA('function');
			expect(r1.setBar).toBeA('function');
			expect(r1.setBar.type).toBeA('string');
			expect(r1.r2).toBeA('function');
			expect(r1.r2.setQux).toBeA('function');
			expect(r1.r2.setQux.type).toBeA('string');
		});

		it('throws an error for duplicate action types', () => {
			const a = new Actionize;

			a.set('r1', build => {
				const r1 = build.reducer({ r1: true }, {
					setBar: (state, action) => Object.assign({}, state, { r1Bar: action.bar })
				});
				const r2 = build.reducer({ r2: true }, {
					setBar: (state, action) => Object.assign({}, state, { r2Bar: action.bar })
				});
				return build.combinePlain({ r1, r2 });
			});

			expect(() => a.get('r1')).toThrow(/action "|r1:setBar" is defined twice/i);
		});

		it('ignores non-function properties on reducer', () => {
			const a = new Actionize;

			a.set('r', build => {
				const r = build.reducer({ r1: true }, {
					setBar: (state, action) => Object.assign({}, state, { bar: action.bar }),
				});
				r.notAFunction1 = 123;
				r.notAFunction2 = {};
				r.notAFunction3 = true;
				r.notAFunction4 = 'yo';
				return r;
			});

			const r = a.get('r');
			expect(r).toBeA('function');
			expect(r.setBar).toBeA('function');
			expect(r.setBar.type).toBeA('string');
			expect(r.notAFunction1).toBeA('number');
			expect(r.notAFunction2).toBeA('object');
			expect(r.notAFunction3).toBeA('boolean');
			expect(r.notAFunction4).toBeA('string');
		});

	});

	describe('dispatcher', () => {

		it('works with a reducer', () => {
			const a = new Actionize;
			const reducer = a.define('dispatcher1', build => build.reducer({}, {
				foo: (state, action) => 'foo' + action.text,
				bar: (state, action) => 'bar' + action.text
			}));
			const dispatched = [];
			const dispatcher = a.dispatcher(
				reducer,
				action => dispatched.push(reducer('state', action))
			);
			dispatcher.foo({ text: 'baz' });
			dispatcher.bar({ text: 'qux' });
			expect(dispatched).toEqual([ 'foobaz', 'barqux' ]);
		});

		it('works with actions and objects', () => {
			const a = new Actionize;
			const reducer = a.define('dispatcher2', build => build.reducer({}, {
				foo: (state, action) => 'foo' + action.text,
				bar: (state, action) => 'bar' + action.text
			}));
			const dispatched = [];
			const dispatcher = a.dispatcher(
				{
					r1: reducer,
					customName1: reducer.foo,
					customName2: {
						customName3: reducer.bar
					}
				},
				action => dispatched.push(reducer('state', action))
			);
			dispatcher.r1.foo({ text: '1' });
			dispatcher.r1.bar({ text: '2' });
			dispatcher.customName1({ text: '3' });
			dispatcher.customName2.customName3({ text: '4' });
			expect(dispatched).toEqual([ 'foo1', 'bar2', 'foo3', 'bar4' ]);
		});
	});

	describe('validateName', () => {

		it('throws an error when name is not a string', () => {
			expect(() => Actionize.validateName(123)).toThrow(/must be a string/i);
			expect(() => Actionize.validateName({})).toThrow(/must be a string/i);
			expect(() => Actionize.validateName(() => null)).toThrow(/must be a string/i);
			expect(() => Actionize.validateName(true)).toThrow(/must be a string/i);
		});

		it('throws an error when name contains invalid characters', () => {
			expect(() => Actionize.validateName("invalid#char")).toThrow(/cannot contain character/i);
			expect(() => Actionize.validateName("invalid|char")).toThrow(/cannot contain character/i);
			expect(() => Actionize.validateName("invalid:char")).toThrow(/cannot contain character/i);
		});

	});

	describe('validateActionKey', () => {

		it('throws an error when key is not a string', () => {
			expect(() => Actionize.validateActionKey(123)).toThrow(/must be a string/i);
			expect(() => Actionize.validateActionKey({})).toThrow(/must be a string/i);
			expect(() => Actionize.validateActionKey(() => null)).toThrow(/must be a string/i);
			expect(() => Actionize.validateActionKey(true)).toThrow(/must be a string/i);
		});

		it('throws an error when name contains invalid characters', () => {
			expect(() => Actionize.validateActionKey("invalid#char")).toThrow(/cannot contain character/i);
			expect(() => Actionize.validateActionKey("invalid|char")).toThrow(/cannot contain character/i);
			expect(() => Actionize.validateActionKey("invalid:char")).toThrow(/cannot contain character/i);
			expect(() => Actionize.validateActionKey("invalid.char")).toThrow(/cannot contain character/i);
		});

	});


});
