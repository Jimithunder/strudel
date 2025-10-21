import {
  strudelScope,
  reify,
  fast,
  slow,
  seq,
  stepcat,
  extend,
  expand,
  pace,
  chooseIn,
  degradeBy,
  silence,
  s,
  n,
  gain,
  note,
  velocity,
  pan,
  speed,
  cut,
  room,
  size,
  delay,
  delaytime,
  delayfeedback,
  vowel,
  shape,
  crush,
  coarse,
  lpf,
  hpf,
  bpf,
  resonance,
} from '@strudel/core';
import { registerLanguage } from '@strudel/transpiler';
import { MondoRunner } from 'mondolang';

const tail = (friend, pat) => pat.fmap((a) => (b) => (Array.isArray(a) ? [...a, b] : [a, b])).appLeft(friend);

const arrayRange = (start, stop, step = 1) =>
  Array.from({ length: Math.abs(stop - start) / step + 1 }, (_, index) =>
    start < stop ? start + index * step : start - index * step,
  );
const range = (max, min) => min.squeezeBind((a) => max.bind((b) => seq(...arrayRange(a, b))));

let nope = (...args) => args[args.length - 1];

let lib = {};
lib['nope'] = nope;
lib['-'] = (a, b) => b.early(a);
lib['+'] = (a, b) => b.late(a);
lib['_'] = silence;
lib['~'] = silence;
lib.curly = stepcat;
lib.square = (...args) => stepcat(...args).setSteps(1);
lib.angle = (...args) => stepcat(...args).pace(1);
lib['*'] = fast;
lib['/'] = slow;
lib['!'] = extend;
lib['@'] = expand;
lib['%'] = pace;
lib['?'] = degradeBy; // todo: default 0.5 not working..
lib[':'] = tail;
lib['..'] = range;
lib['def'] = () => silence;
lib['or'] = (...children) => chooseIn(...children); // always has structure but is cyclewise.. e.g. "s oh*8.dec[.04 | .5]"
//lib['or'] = (...children) => chooseOut(...children); // "s oh*8.dec[.04 | .5]" is better but "dec[.04 | .5].s oh*8" has no struct

// Add common controls
lib['s'] = s;
lib['n'] = n;
lib['gain'] = gain;
lib['note'] = note;
lib['velocity'] = velocity;
lib['pan'] = pan;
lib['speed'] = speed;
lib['cut'] = cut;
lib['room'] = room;
lib['size'] = size;
lib['delay'] = delay;
lib['delaytime'] = delaytime;
lib['delayfeedback'] = delayfeedback;
lib['vowel'] = vowel;
lib['shape'] = shape;
lib['crush'] = crush;
lib['coarse'] = coarse;
lib['lpf'] = lpf;
lib['hpf'] = hpf;
lib['bpf'] = bpf;
lib['resonance'] = resonance;

// These operators allow combining ControlPatterns by merging their control objects.
// For duplicate keys (same control), arithmetic operations are applied.
// For different keys, values are simply merged.
//
// Operator variants:
// - mix (|op|): Structure from both patterns (appBoth)
// - in (|op):   Structure from left pattern (appLeft)
// - out (op|):  Structure from right pattern (appRight)
//
// Example: s [bd hh sd cp] |+| n [0 1 2]
// Combines sound and note patterns, creating events at the intersection of both.

// Helper function to create safe operation functions
// If both values are numbers, apply the operation; otherwise return the right value
const createSafeOp = (op) => (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return op(a, b);
  return b; // If not both numbers, take right value
};

const safeAdd = createSafeOp((a, b) => a + b);
const safeSub = createSafeOp((a, b) => a - b);
const safeMul = createSafeOp((a, b) => a * b);
const safeDiv = createSafeOp((a, b) => a / b);
const safeMod = createSafeOp((a, b) => a % b);

// Helper function to merge two control objects using an operation
const mergeControls = (av, bv, safeOp) => {
  if (typeof av === 'object' && typeof bv === 'object') {
    const common = Object.keys(av).filter((k) => Object.keys(bv).includes(k));
    return Object.assign({}, av, bv, Object.fromEntries(common.map((k) => [k, safeOp(av[k], bv[k])])));
  }
  return safeOp(av, bv);
};

// Factory function to create structured operator helpers
// safeOp: the safe operation function (safeAdd, safeSub, etc.)
// appMethod: the applicative method to use ('appBoth', 'appLeft', or 'appRight')
const createStructuredOp = (safeOp, appMethod) => (a, b) =>
  reify(a)
    .fmap((av) => (bv) => mergeControls(av, bv, safeOp))
    [appMethod](reify(b));

// Register all structured operators
const operators = ['add', 'sub', 'mul', 'div', 'mod'];
const safeOps = { add: safeAdd, sub: safeSub, mul: safeMul, div: safeDiv, mod: safeMod };
const variants = { mix: 'appBoth', in: 'appLeft', out: 'appRight' };

for (const op of operators) {
  for (const [variant, appMethod] of Object.entries(variants)) {
    lib[`_${op}_${variant}`] = createStructuredOp(safeOps[op], appMethod);
  }
}

function evaluator(node, scope) {
  const { type } = node;
  // node is list
  if (type === 'list') {
    const { children } = node;
    const filtered = children.filter((child) => child.type !== 'comment');
    const [name, ...args] = filtered;
    // some functions wont be reified to make sure they work (e.g. see extend below)
    if (typeof name === 'function') {
      return name(...args);
    }
    if (name.value === 'def') {
      return silence;
    }
    // name is expected to be a pattern of functions!
    const first = name.firstCycle(true)[0];
    const type = typeof first?.value;
    if (type !== 'function') {
      throw new Error(`[mondough] expected function, got "${first?.value}"`);
    }
    return name
      .fmap((fn) => {
        if (typeof fn !== 'function') {
          throw new Error(`[mondough] "${fn}" is not a function b`);
        }
        return fn(...args);
      })
      .innerJoin();
  }
  // node is leaf
  let { value } = node;
  if (type === 'plain' && scope[value]) {
    return reify(scope[value]); // -> local scope has no location
  }
  const variable = lib[value] ?? strudelScope[value];
  // problem: collisions when we want a string that happens to also be a variable name
  // example: "s sine" -> sine is also a variable
  let pat;
  if (type === 'plain' && typeof variable !== 'undefined') {
    // some function names are not patternable, so we skip reification here
    if (['!', 'extend', '@', 'expand', 'square', 'angle', 'all', 'setcpm', 'setcps'].includes(value)) {
      return variable;
    }
    pat = reify(variable);
  } else {
    pat = reify(value);
  }
  if (node.loc) {
    pat = pat.withLoc(node.loc[0], node.loc[1]);
  }
  return pat;
}

let runner = new MondoRunner({ evaluator });

export function mondo(code, offset = 0) {
  if (Array.isArray(code)) {
    code = code.join('');
  }
  const pat = runner.run(code, undefined, offset);
  return pat.markcss('color: var(--caret,--foreground);text-decoration:underline');
}

export let getLocations = (code, offset) => runner.parser.get_locations(code, offset);

export const mondi = (str, offset) => {
  const code = `[${str}]`;
  return mondo(code, offset);
};

// tell transpiler how to get locations for mondo`` calls
registerLanguage('mondo', {
  getLocations,
});

// this is like mondo, but with a zero offset
export const mondolang = (code) => mondo(code, 0);
registerLanguage('mondolang', {
  getLocations: (code) => getLocations(code, 0),
});
// uncomment the following to use mondo as mini notation language
/* registerLanguage('minilang', {
  name: 'mondi',
  getLocations,
}); */
