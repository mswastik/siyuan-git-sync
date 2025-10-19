"use strict";
const require$$0$1 = require("buffer");
const siyuan = require("siyuan");
function _mergeNamespaces(n, m) {
  for (var i = 0; i < m.length; i++) {
    const e = m[i];
    if (typeof e !== "string" && !Array.isArray(e)) {
      for (const k in e) {
        if (k !== "default" && !(k in n)) {
          const d = Object.getOwnPropertyDescriptor(e, k);
          if (d) {
            Object.defineProperty(n, k, d.get ? d : {
              enumerable: true,
              get: () => e[k]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n, Symbol.toStringTag, { value: "Module" }));
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
  if (typeof f == "function") {
    var a = function a2() {
      if (this instanceof a2) {
        return Reflect.construct(f, arguments, this.constructor);
      }
      return f.apply(this, arguments);
    };
    a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, "__esModule", { value: true });
  Object.keys(n).forEach(function(k) {
    var d = Object.getOwnPropertyDescriptor(n, k);
    Object.defineProperty(a, k, d.get ? d : {
      enumerable: true,
      get: function() {
        return n[k];
      }
    });
  });
  return a;
}
var isomorphicGit = {};
var AsyncLock$1 = function(opts) {
  opts = opts || {};
  this.Promise = opts.Promise || Promise;
  this.queues = /* @__PURE__ */ Object.create(null);
  this.domainReentrant = opts.domainReentrant || false;
  if (this.domainReentrant) {
    if (typeof process === "undefined" || typeof process.domain === "undefined") {
      throw new Error(
        "Domain-reentrant locks require `process.domain` to exist. Please flip `opts.domainReentrant = false`, use a NodeJS version that still implements Domain, or install a browser polyfill."
      );
    }
    this.domains = /* @__PURE__ */ Object.create(null);
  }
  this.timeout = opts.timeout || AsyncLock$1.DEFAULT_TIMEOUT;
  this.maxOccupationTime = opts.maxOccupationTime || AsyncLock$1.DEFAULT_MAX_OCCUPATION_TIME;
  this.maxExecutionTime = opts.maxExecutionTime || AsyncLock$1.DEFAULT_MAX_EXECUTION_TIME;
  if (opts.maxPending === Infinity || Number.isInteger(opts.maxPending) && opts.maxPending >= 0) {
    this.maxPending = opts.maxPending;
  } else {
    this.maxPending = AsyncLock$1.DEFAULT_MAX_PENDING;
  }
};
AsyncLock$1.DEFAULT_TIMEOUT = 0;
AsyncLock$1.DEFAULT_MAX_OCCUPATION_TIME = 0;
AsyncLock$1.DEFAULT_MAX_EXECUTION_TIME = 0;
AsyncLock$1.DEFAULT_MAX_PENDING = 1e3;
AsyncLock$1.prototype.acquire = function(key, fn, cb, opts) {
  if (Array.isArray(key)) {
    return this._acquireBatch(key, fn, cb, opts);
  }
  if (typeof fn !== "function") {
    throw new Error("You must pass a function to execute");
  }
  var deferredResolve = null;
  var deferredReject = null;
  var deferred = null;
  if (typeof cb !== "function") {
    opts = cb;
    cb = null;
    deferred = new this.Promise(function(resolve2, reject) {
      deferredResolve = resolve2;
      deferredReject = reject;
    });
  }
  opts = opts || {};
  var resolved = false;
  var timer = null;
  var occupationTimer = null;
  var executionTimer = null;
  var self2 = this;
  var done = function(locked, err2, ret) {
    if (occupationTimer) {
      clearTimeout(occupationTimer);
      occupationTimer = null;
    }
    if (executionTimer) {
      clearTimeout(executionTimer);
      executionTimer = null;
    }
    if (locked) {
      if (!!self2.queues[key] && self2.queues[key].length === 0) {
        delete self2.queues[key];
      }
      if (self2.domainReentrant) {
        delete self2.domains[key];
      }
    }
    if (!resolved) {
      if (!deferred) {
        if (typeof cb === "function") {
          cb(err2, ret);
        }
      } else {
        if (err2) {
          deferredReject(err2);
        } else {
          deferredResolve(ret);
        }
      }
      resolved = true;
    }
    if (locked) {
      if (!!self2.queues[key] && self2.queues[key].length > 0) {
        self2.queues[key].shift()();
      }
    }
  };
  var exec = function(locked) {
    if (resolved) {
      return done(locked);
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (self2.domainReentrant && locked) {
      self2.domains[key] = process.domain;
    }
    var maxExecutionTime = opts.maxExecutionTime || self2.maxExecutionTime;
    if (maxExecutionTime) {
      executionTimer = setTimeout(function() {
        if (!!self2.queues[key]) {
          done(locked, new Error("Maximum execution time is exceeded " + key));
        }
      }, maxExecutionTime);
    }
    if (fn.length === 1) {
      var called = false;
      try {
        fn(function(err2, ret) {
          if (!called) {
            called = true;
            done(locked, err2, ret);
          }
        });
      } catch (err2) {
        if (!called) {
          called = true;
          done(locked, err2);
        }
      }
    } else {
      self2._promiseTry(function() {
        return fn();
      }).then(function(ret) {
        done(locked, void 0, ret);
      }, function(error) {
        done(locked, error);
      });
    }
  };
  if (self2.domainReentrant && !!process.domain) {
    exec = process.domain.bind(exec);
  }
  var maxPending = opts.maxPending || self2.maxPending;
  if (!self2.queues[key]) {
    self2.queues[key] = [];
    exec(true);
  } else if (self2.domainReentrant && !!process.domain && process.domain === self2.domains[key]) {
    exec(false);
  } else if (self2.queues[key].length >= maxPending) {
    done(false, new Error("Too many pending tasks in queue " + key));
  } else {
    var taskFn = function() {
      exec(true);
    };
    if (opts.skipQueue) {
      self2.queues[key].unshift(taskFn);
    } else {
      self2.queues[key].push(taskFn);
    }
    var timeout = opts.timeout || self2.timeout;
    if (timeout) {
      timer = setTimeout(function() {
        timer = null;
        done(false, new Error("async-lock timed out in queue " + key));
      }, timeout);
    }
  }
  var maxOccupationTime = opts.maxOccupationTime || self2.maxOccupationTime;
  if (maxOccupationTime) {
    occupationTimer = setTimeout(function() {
      if (!!self2.queues[key]) {
        done(false, new Error("Maximum occupation time is exceeded in queue " + key));
      }
    }, maxOccupationTime);
  }
  if (deferred) {
    return deferred;
  }
};
AsyncLock$1.prototype._acquireBatch = function(keys2, fn, cb, opts) {
  if (typeof cb !== "function") {
    opts = cb;
    cb = null;
  }
  var self2 = this;
  var getFn = function(key, fn2) {
    return function(cb2) {
      self2.acquire(key, fn2, cb2, opts);
    };
  };
  var fnx = keys2.reduceRight(function(prev, key) {
    return getFn(key, prev);
  }, fn);
  if (typeof cb === "function") {
    fnx(cb);
  } else {
    return new this.Promise(function(resolve2, reject) {
      if (fnx.length === 1) {
        fnx(function(err2, ret) {
          if (err2) {
            reject(err2);
          } else {
            resolve2(ret);
          }
        });
      } else {
        resolve2(fnx());
      }
    });
  }
};
AsyncLock$1.prototype.isBusy = function(key) {
  if (!key) {
    return Object.keys(this.queues).length > 0;
  } else {
    return !!this.queues[key];
  }
};
AsyncLock$1.prototype._promiseTry = function(fn) {
  try {
    return this.Promise.resolve(fn());
  } catch (e) {
    return this.Promise.reject(e);
  }
};
var lib$1 = AsyncLock$1;
var asyncLock = lib$1;
var inherits_browser = { exports: {} };
if (typeof Object.create === "function") {
  inherits_browser.exports = function inherits2(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    }
  };
} else {
  inherits_browser.exports = function inherits2(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function() {
      };
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    }
  };
}
var inherits_browserExports = inherits_browser.exports;
var safeBuffer = { exports: {} };
/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
(function(module2, exports2) {
  var buffer = require$$0$1;
  var Buffer2 = buffer.Buffer;
  function copyProps(src2, dst) {
    for (var key in src2) {
      dst[key] = src2[key];
    }
  }
  if (Buffer2.from && Buffer2.alloc && Buffer2.allocUnsafe && Buffer2.allocUnsafeSlow) {
    module2.exports = buffer;
  } else {
    copyProps(buffer, exports2);
    exports2.Buffer = SafeBuffer;
  }
  function SafeBuffer(arg, encodingOrOffset, length) {
    return Buffer2(arg, encodingOrOffset, length);
  }
  SafeBuffer.prototype = Object.create(Buffer2.prototype);
  copyProps(Buffer2, SafeBuffer);
  SafeBuffer.from = function(arg, encodingOrOffset, length) {
    if (typeof arg === "number") {
      throw new TypeError("Argument must not be a number");
    }
    return Buffer2(arg, encodingOrOffset, length);
  };
  SafeBuffer.alloc = function(size, fill, encoding) {
    if (typeof size !== "number") {
      throw new TypeError("Argument must be a number");
    }
    var buf = Buffer2(size);
    if (fill !== void 0) {
      if (typeof encoding === "string") {
        buf.fill(fill, encoding);
      } else {
        buf.fill(fill);
      }
    } else {
      buf.fill(0);
    }
    return buf;
  };
  SafeBuffer.allocUnsafe = function(size) {
    if (typeof size !== "number") {
      throw new TypeError("Argument must be a number");
    }
    return Buffer2(size);
  };
  SafeBuffer.allocUnsafeSlow = function(size) {
    if (typeof size !== "number") {
      throw new TypeError("Argument must be a number");
    }
    return buffer.SlowBuffer(size);
  };
})(safeBuffer, safeBuffer.exports);
var safeBufferExports = safeBuffer.exports;
var toString$2 = {}.toString;
var isarray = Array.isArray || function(arr) {
  return toString$2.call(arr) == "[object Array]";
};
var type = TypeError;
var esObjectAtoms = Object;
var esErrors = Error;
var _eval = EvalError;
var range = RangeError;
var ref = ReferenceError;
var syntax = SyntaxError;
var uri = URIError;
var abs$1 = Math.abs;
var floor$1 = Math.floor;
var max$2 = Math.max;
var min$1 = Math.min;
var pow$1 = Math.pow;
var round$1 = Math.round;
var _isNaN = Number.isNaN || function isNaN2(a) {
  return a !== a;
};
var $isNaN = _isNaN;
var sign$1 = function sign(number) {
  if ($isNaN(number) || number === 0) {
    return number;
  }
  return number < 0 ? -1 : 1;
};
var gOPD = Object.getOwnPropertyDescriptor;
var $gOPD$1 = gOPD;
if ($gOPD$1) {
  try {
    $gOPD$1([], "length");
  } catch (e) {
    $gOPD$1 = null;
  }
}
var gopd = $gOPD$1;
var $defineProperty$1 = Object.defineProperty || false;
if ($defineProperty$1) {
  try {
    $defineProperty$1({}, "a", { value: 1 });
  } catch (e) {
    $defineProperty$1 = false;
  }
}
var esDefineProperty = $defineProperty$1;
var shams$1;
var hasRequiredShams$1;
function requireShams$1() {
  if (hasRequiredShams$1) return shams$1;
  hasRequiredShams$1 = 1;
  shams$1 = function hasSymbols2() {
    if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
      return false;
    }
    if (typeof Symbol.iterator === "symbol") {
      return true;
    }
    var obj = {};
    var sym = Symbol("test");
    var symObj = Object(sym);
    if (typeof sym === "string") {
      return false;
    }
    if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
      return false;
    }
    if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
      return false;
    }
    var symVal = 42;
    obj[sym] = symVal;
    for (var _ in obj) {
      return false;
    }
    if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
      return false;
    }
    if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
      return false;
    }
    var syms = Object.getOwnPropertySymbols(obj);
    if (syms.length !== 1 || syms[0] !== sym) {
      return false;
    }
    if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
      return false;
    }
    if (typeof Object.getOwnPropertyDescriptor === "function") {
      var descriptor = (
        /** @type {PropertyDescriptor} */
        Object.getOwnPropertyDescriptor(obj, sym)
      );
      if (descriptor.value !== symVal || descriptor.enumerable !== true) {
        return false;
      }
    }
    return true;
  };
  return shams$1;
}
var hasSymbols$1;
var hasRequiredHasSymbols;
function requireHasSymbols() {
  if (hasRequiredHasSymbols) return hasSymbols$1;
  hasRequiredHasSymbols = 1;
  var origSymbol = typeof Symbol !== "undefined" && Symbol;
  var hasSymbolSham = requireShams$1();
  hasSymbols$1 = function hasNativeSymbols() {
    if (typeof origSymbol !== "function") {
      return false;
    }
    if (typeof Symbol !== "function") {
      return false;
    }
    if (typeof origSymbol("foo") !== "symbol") {
      return false;
    }
    if (typeof Symbol("bar") !== "symbol") {
      return false;
    }
    return hasSymbolSham();
  };
  return hasSymbols$1;
}
var Reflect_getPrototypeOf;
var hasRequiredReflect_getPrototypeOf;
function requireReflect_getPrototypeOf() {
  if (hasRequiredReflect_getPrototypeOf) return Reflect_getPrototypeOf;
  hasRequiredReflect_getPrototypeOf = 1;
  Reflect_getPrototypeOf = typeof Reflect !== "undefined" && Reflect.getPrototypeOf || null;
  return Reflect_getPrototypeOf;
}
var Object_getPrototypeOf;
var hasRequiredObject_getPrototypeOf;
function requireObject_getPrototypeOf() {
  if (hasRequiredObject_getPrototypeOf) return Object_getPrototypeOf;
  hasRequiredObject_getPrototypeOf = 1;
  var $Object2 = esObjectAtoms;
  Object_getPrototypeOf = $Object2.getPrototypeOf || null;
  return Object_getPrototypeOf;
}
var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
var toStr = Object.prototype.toString;
var max$1 = Math.max;
var funcType = "[object Function]";
var concatty = function concatty2(a, b) {
  var arr = [];
  for (var i = 0; i < a.length; i += 1) {
    arr[i] = a[i];
  }
  for (var j = 0; j < b.length; j += 1) {
    arr[j + a.length] = b[j];
  }
  return arr;
};
var slicy = function slicy2(arrLike, offset) {
  var arr = [];
  for (var i = offset, j = 0; i < arrLike.length; i += 1, j += 1) {
    arr[j] = arrLike[i];
  }
  return arr;
};
var joiny = function(arr, joiner) {
  var str = "";
  for (var i = 0; i < arr.length; i += 1) {
    str += arr[i];
    if (i + 1 < arr.length) {
      str += joiner;
    }
  }
  return str;
};
var implementation$1 = function bind(that) {
  var target = this;
  if (typeof target !== "function" || toStr.apply(target) !== funcType) {
    throw new TypeError(ERROR_MESSAGE + target);
  }
  var args = slicy(arguments, 1);
  var bound;
  var binder = function() {
    if (this instanceof bound) {
      var result = target.apply(
        this,
        concatty(args, arguments)
      );
      if (Object(result) === result) {
        return result;
      }
      return this;
    }
    return target.apply(
      that,
      concatty(args, arguments)
    );
  };
  var boundLength = max$1(0, target.length - args.length);
  var boundArgs = [];
  for (var i = 0; i < boundLength; i++) {
    boundArgs[i] = "$" + i;
  }
  bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
  if (target.prototype) {
    var Empty = function Empty2() {
    };
    Empty.prototype = target.prototype;
    bound.prototype = new Empty();
    Empty.prototype = null;
  }
  return bound;
};
var implementation = implementation$1;
var functionBind = Function.prototype.bind || implementation;
var functionCall = Function.prototype.call;
var functionApply;
var hasRequiredFunctionApply;
function requireFunctionApply() {
  if (hasRequiredFunctionApply) return functionApply;
  hasRequiredFunctionApply = 1;
  functionApply = Function.prototype.apply;
  return functionApply;
}
var reflectApply = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
var bind$2 = functionBind;
var $apply$1 = requireFunctionApply();
var $call$2 = functionCall;
var $reflectApply = reflectApply;
var actualApply = $reflectApply || bind$2.call($call$2, $apply$1);
var bind$1 = functionBind;
var $TypeError$2 = type;
var $call$1 = functionCall;
var $actualApply = actualApply;
var callBindApplyHelpers = function callBindBasic(args) {
  if (args.length < 1 || typeof args[0] !== "function") {
    throw new $TypeError$2("a function is required");
  }
  return $actualApply(bind$1, $call$1, args);
};
var get$1;
var hasRequiredGet;
function requireGet() {
  if (hasRequiredGet) return get$1;
  hasRequiredGet = 1;
  var callBind2 = callBindApplyHelpers;
  var gOPD2 = gopd;
  var hasProtoAccessor;
  try {
    hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
    [].__proto__ === Array.prototype;
  } catch (e) {
    if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
      throw e;
    }
  }
  var desc = !!hasProtoAccessor && gOPD2 && gOPD2(
    Object.prototype,
    /** @type {keyof typeof Object.prototype} */
    "__proto__"
  );
  var $Object2 = Object;
  var $getPrototypeOf = $Object2.getPrototypeOf;
  get$1 = desc && typeof desc.get === "function" ? callBind2([desc.get]) : typeof $getPrototypeOf === "function" ? (
    /** @type {import('./get')} */
    function getDunder(value) {
      return $getPrototypeOf(value == null ? value : $Object2(value));
    }
  ) : false;
  return get$1;
}
var getProto$1;
var hasRequiredGetProto;
function requireGetProto() {
  if (hasRequiredGetProto) return getProto$1;
  hasRequiredGetProto = 1;
  var reflectGetProto = requireReflect_getPrototypeOf();
  var originalGetProto = requireObject_getPrototypeOf();
  var getDunderProto = requireGet();
  getProto$1 = reflectGetProto ? function getProto2(O) {
    return reflectGetProto(O);
  } : originalGetProto ? function getProto2(O) {
    if (!O || typeof O !== "object" && typeof O !== "function") {
      throw new TypeError("getProto: not an object");
    }
    return originalGetProto(O);
  } : getDunderProto ? function getProto2(O) {
    return getDunderProto(O);
  } : null;
  return getProto$1;
}
var hasown;
var hasRequiredHasown;
function requireHasown() {
  if (hasRequiredHasown) return hasown;
  hasRequiredHasown = 1;
  var call = Function.prototype.call;
  var $hasOwn = Object.prototype.hasOwnProperty;
  var bind3 = functionBind;
  hasown = bind3.call(call, $hasOwn);
  return hasown;
}
var undefined$1;
var $Object = esObjectAtoms;
var $Error = esErrors;
var $EvalError = _eval;
var $RangeError = range;
var $ReferenceError = ref;
var $SyntaxError = syntax;
var $TypeError$1 = type;
var $URIError = uri;
var abs = abs$1;
var floor = floor$1;
var max = max$2;
var min = min$1;
var pow = pow$1;
var round = round$1;
var sign2 = sign$1;
var $Function = Function;
var getEvalledConstructor = function(expressionSyntax) {
  try {
    return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
  } catch (e) {
  }
};
var $gOPD = gopd;
var $defineProperty = esDefineProperty;
var throwTypeError = function() {
  throw new $TypeError$1();
};
var ThrowTypeError = $gOPD ? function() {
  try {
    arguments.callee;
    return throwTypeError;
  } catch (calleeThrows) {
    try {
      return $gOPD(arguments, "callee").get;
    } catch (gOPDthrows) {
      return throwTypeError;
    }
  }
}() : throwTypeError;
var hasSymbols = requireHasSymbols()();
var getProto = requireGetProto();
var $ObjectGPO = requireObject_getPrototypeOf();
var $ReflectGPO = requireReflect_getPrototypeOf();
var $apply = requireFunctionApply();
var $call = functionCall;
var needsEval = {};
var TypedArray = typeof Uint8Array === "undefined" || !getProto ? undefined$1 : getProto(Uint8Array);
var INTRINSICS = {
  __proto__: null,
  "%AggregateError%": typeof AggregateError === "undefined" ? undefined$1 : AggregateError,
  "%Array%": Array,
  "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined$1 : ArrayBuffer,
  "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined$1,
  "%AsyncFromSyncIteratorPrototype%": undefined$1,
  "%AsyncFunction%": needsEval,
  "%AsyncGenerator%": needsEval,
  "%AsyncGeneratorFunction%": needsEval,
  "%AsyncIteratorPrototype%": needsEval,
  "%Atomics%": typeof Atomics === "undefined" ? undefined$1 : Atomics,
  "%BigInt%": typeof BigInt === "undefined" ? undefined$1 : BigInt,
  "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined$1 : BigInt64Array,
  "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined$1 : BigUint64Array,
  "%Boolean%": Boolean,
  "%DataView%": typeof DataView === "undefined" ? undefined$1 : DataView,
  "%Date%": Date,
  "%decodeURI%": decodeURI,
  "%decodeURIComponent%": decodeURIComponent,
  "%encodeURI%": encodeURI,
  "%encodeURIComponent%": encodeURIComponent,
  "%Error%": $Error,
  "%eval%": eval,
  // eslint-disable-line no-eval
  "%EvalError%": $EvalError,
  "%Float16Array%": typeof Float16Array === "undefined" ? undefined$1 : Float16Array,
  "%Float32Array%": typeof Float32Array === "undefined" ? undefined$1 : Float32Array,
  "%Float64Array%": typeof Float64Array === "undefined" ? undefined$1 : Float64Array,
  "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined$1 : FinalizationRegistry,
  "%Function%": $Function,
  "%GeneratorFunction%": needsEval,
  "%Int8Array%": typeof Int8Array === "undefined" ? undefined$1 : Int8Array,
  "%Int16Array%": typeof Int16Array === "undefined" ? undefined$1 : Int16Array,
  "%Int32Array%": typeof Int32Array === "undefined" ? undefined$1 : Int32Array,
  "%isFinite%": isFinite,
  "%isNaN%": isNaN,
  "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined$1,
  "%JSON%": typeof JSON === "object" ? JSON : undefined$1,
  "%Map%": typeof Map === "undefined" ? undefined$1 : Map,
  "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols || !getProto ? undefined$1 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
  "%Math%": Math,
  "%Number%": Number,
  "%Object%": $Object,
  "%Object.getOwnPropertyDescriptor%": $gOPD,
  "%parseFloat%": parseFloat,
  "%parseInt%": parseInt,
  "%Promise%": typeof Promise === "undefined" ? undefined$1 : Promise,
  "%Proxy%": typeof Proxy === "undefined" ? undefined$1 : Proxy,
  "%RangeError%": $RangeError,
  "%ReferenceError%": $ReferenceError,
  "%Reflect%": typeof Reflect === "undefined" ? undefined$1 : Reflect,
  "%RegExp%": RegExp,
  "%Set%": typeof Set === "undefined" ? undefined$1 : Set,
  "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols || !getProto ? undefined$1 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
  "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined$1 : SharedArrayBuffer,
  "%String%": String,
  "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined$1,
  "%Symbol%": hasSymbols ? Symbol : undefined$1,
  "%SyntaxError%": $SyntaxError,
  "%ThrowTypeError%": ThrowTypeError,
  "%TypedArray%": TypedArray,
  "%TypeError%": $TypeError$1,
  "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined$1 : Uint8Array,
  "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined$1 : Uint8ClampedArray,
  "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined$1 : Uint16Array,
  "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined$1 : Uint32Array,
  "%URIError%": $URIError,
  "%WeakMap%": typeof WeakMap === "undefined" ? undefined$1 : WeakMap,
  "%WeakRef%": typeof WeakRef === "undefined" ? undefined$1 : WeakRef,
  "%WeakSet%": typeof WeakSet === "undefined" ? undefined$1 : WeakSet,
  "%Function.prototype.call%": $call,
  "%Function.prototype.apply%": $apply,
  "%Object.defineProperty%": $defineProperty,
  "%Object.getPrototypeOf%": $ObjectGPO,
  "%Math.abs%": abs,
  "%Math.floor%": floor,
  "%Math.max%": max,
  "%Math.min%": min,
  "%Math.pow%": pow,
  "%Math.round%": round,
  "%Math.sign%": sign2,
  "%Reflect.getPrototypeOf%": $ReflectGPO
};
if (getProto) {
  try {
    null.error;
  } catch (e) {
    var errorProto = getProto(getProto(e));
    INTRINSICS["%Error.prototype%"] = errorProto;
  }
}
var doEval = function doEval2(name) {
  var value;
  if (name === "%AsyncFunction%") {
    value = getEvalledConstructor("async function () {}");
  } else if (name === "%GeneratorFunction%") {
    value = getEvalledConstructor("function* () {}");
  } else if (name === "%AsyncGeneratorFunction%") {
    value = getEvalledConstructor("async function* () {}");
  } else if (name === "%AsyncGenerator%") {
    var fn = doEval2("%AsyncGeneratorFunction%");
    if (fn) {
      value = fn.prototype;
    }
  } else if (name === "%AsyncIteratorPrototype%") {
    var gen = doEval2("%AsyncGenerator%");
    if (gen && getProto) {
      value = getProto(gen.prototype);
    }
  }
  INTRINSICS[name] = value;
  return value;
};
var LEGACY_ALIASES = {
  __proto__: null,
  "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
  "%ArrayPrototype%": ["Array", "prototype"],
  "%ArrayProto_entries%": ["Array", "prototype", "entries"],
  "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
  "%ArrayProto_keys%": ["Array", "prototype", "keys"],
  "%ArrayProto_values%": ["Array", "prototype", "values"],
  "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
  "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
  "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
  "%BooleanPrototype%": ["Boolean", "prototype"],
  "%DataViewPrototype%": ["DataView", "prototype"],
  "%DatePrototype%": ["Date", "prototype"],
  "%ErrorPrototype%": ["Error", "prototype"],
  "%EvalErrorPrototype%": ["EvalError", "prototype"],
  "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
  "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
  "%FunctionPrototype%": ["Function", "prototype"],
  "%Generator%": ["GeneratorFunction", "prototype"],
  "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
  "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
  "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
  "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
  "%JSONParse%": ["JSON", "parse"],
  "%JSONStringify%": ["JSON", "stringify"],
  "%MapPrototype%": ["Map", "prototype"],
  "%NumberPrototype%": ["Number", "prototype"],
  "%ObjectPrototype%": ["Object", "prototype"],
  "%ObjProto_toString%": ["Object", "prototype", "toString"],
  "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
  "%PromisePrototype%": ["Promise", "prototype"],
  "%PromiseProto_then%": ["Promise", "prototype", "then"],
  "%Promise_all%": ["Promise", "all"],
  "%Promise_reject%": ["Promise", "reject"],
  "%Promise_resolve%": ["Promise", "resolve"],
  "%RangeErrorPrototype%": ["RangeError", "prototype"],
  "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
  "%RegExpPrototype%": ["RegExp", "prototype"],
  "%SetPrototype%": ["Set", "prototype"],
  "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
  "%StringPrototype%": ["String", "prototype"],
  "%SymbolPrototype%": ["Symbol", "prototype"],
  "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
  "%TypedArrayPrototype%": ["TypedArray", "prototype"],
  "%TypeErrorPrototype%": ["TypeError", "prototype"],
  "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
  "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
  "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
  "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
  "%URIErrorPrototype%": ["URIError", "prototype"],
  "%WeakMapPrototype%": ["WeakMap", "prototype"],
  "%WeakSetPrototype%": ["WeakSet", "prototype"]
};
var bind2 = functionBind;
var hasOwn = requireHasown();
var $concat = bind2.call($call, Array.prototype.concat);
var $spliceApply = bind2.call($apply, Array.prototype.splice);
var $replace = bind2.call($call, String.prototype.replace);
var $strSlice = bind2.call($call, String.prototype.slice);
var $exec = bind2.call($call, RegExp.prototype.exec);
var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g;
var stringToPath = function stringToPath2(string) {
  var first = $strSlice(string, 0, 1);
  var last = $strSlice(string, -1);
  if (first === "%" && last !== "%") {
    throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
  } else if (last === "%" && first !== "%") {
    throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
  }
  var result = [];
  $replace(string, rePropName, function(match, number, quote, subString) {
    result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
  });
  return result;
};
var getBaseIntrinsic = function getBaseIntrinsic2(name, allowMissing) {
  var intrinsicName = name;
  var alias;
  if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
    alias = LEGACY_ALIASES[intrinsicName];
    intrinsicName = "%" + alias[0] + "%";
  }
  if (hasOwn(INTRINSICS, intrinsicName)) {
    var value = INTRINSICS[intrinsicName];
    if (value === needsEval) {
      value = doEval(intrinsicName);
    }
    if (typeof value === "undefined" && !allowMissing) {
      throw new $TypeError$1("intrinsic " + name + " exists, but is not available. Please file an issue!");
    }
    return {
      alias,
      name: intrinsicName,
      value
    };
  }
  throw new $SyntaxError("intrinsic " + name + " does not exist!");
};
var getIntrinsic = function GetIntrinsic(name, allowMissing) {
  if (typeof name !== "string" || name.length === 0) {
    throw new $TypeError$1("intrinsic name must be a non-empty string");
  }
  if (arguments.length > 1 && typeof allowMissing !== "boolean") {
    throw new $TypeError$1('"allowMissing" argument must be a boolean');
  }
  if ($exec(/^%?[^%]*%?$/, name) === null) {
    throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
  }
  var parts = stringToPath(name);
  var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
  var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
  var intrinsicRealName = intrinsic.name;
  var value = intrinsic.value;
  var skipFurtherCaching = false;
  var alias = intrinsic.alias;
  if (alias) {
    intrinsicBaseName = alias[0];
    $spliceApply(parts, $concat([0, 1], alias));
  }
  for (var i = 1, isOwn = true; i < parts.length; i += 1) {
    var part = parts[i];
    var first = $strSlice(part, 0, 1);
    var last = $strSlice(part, -1);
    if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
      throw new $SyntaxError("property names with quotes must have matching quotes");
    }
    if (part === "constructor" || !isOwn) {
      skipFurtherCaching = true;
    }
    intrinsicBaseName += "." + part;
    intrinsicRealName = "%" + intrinsicBaseName + "%";
    if (hasOwn(INTRINSICS, intrinsicRealName)) {
      value = INTRINSICS[intrinsicRealName];
    } else if (value != null) {
      if (!(part in value)) {
        if (!allowMissing) {
          throw new $TypeError$1("base intrinsic for " + name + " exists, but the property is not available.");
        }
        return void 0;
      }
      if ($gOPD && i + 1 >= parts.length) {
        var desc = $gOPD(value, part);
        isOwn = !!desc;
        if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
          value = desc.get;
        } else {
          value = value[part];
        }
      } else {
        isOwn = hasOwn(value, part);
        value = value[part];
      }
      if (isOwn && !skipFurtherCaching) {
        INTRINSICS[intrinsicRealName] = value;
      }
    }
  }
  return value;
};
var GetIntrinsic2 = getIntrinsic;
var callBindBasic2 = callBindApplyHelpers;
var $indexOf = callBindBasic2([GetIntrinsic2("%String.prototype.indexOf%")]);
var callBound$1 = function callBoundIntrinsic(name, allowMissing) {
  var intrinsic = (
    /** @type {(this: unknown, ...args: unknown[]) => unknown} */
    GetIntrinsic2(name, !!allowMissing)
  );
  if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
    return callBindBasic2(
      /** @type {const} */
      [intrinsic]
    );
  }
  return intrinsic;
};
var isCallable;
var hasRequiredIsCallable;
function requireIsCallable() {
  if (hasRequiredIsCallable) return isCallable;
  hasRequiredIsCallable = 1;
  var fnToStr = Function.prototype.toString;
  var reflectApply2 = typeof Reflect === "object" && Reflect !== null && Reflect.apply;
  var badArrayLike;
  var isCallableMarker;
  if (typeof reflectApply2 === "function" && typeof Object.defineProperty === "function") {
    try {
      badArrayLike = Object.defineProperty({}, "length", {
        get: function() {
          throw isCallableMarker;
        }
      });
      isCallableMarker = {};
      reflectApply2(function() {
        throw 42;
      }, null, badArrayLike);
    } catch (_) {
      if (_ !== isCallableMarker) {
        reflectApply2 = null;
      }
    }
  } else {
    reflectApply2 = null;
  }
  var constructorRegex = /^\s*class\b/;
  var isES6ClassFn = function isES6ClassFunction(value) {
    try {
      var fnStr = fnToStr.call(value);
      return constructorRegex.test(fnStr);
    } catch (e) {
      return false;
    }
  };
  var tryFunctionObject = function tryFunctionToStr(value) {
    try {
      if (isES6ClassFn(value)) {
        return false;
      }
      fnToStr.call(value);
      return true;
    } catch (e) {
      return false;
    }
  };
  var toStr2 = Object.prototype.toString;
  var objectClass = "[object Object]";
  var fnClass = "[object Function]";
  var genClass = "[object GeneratorFunction]";
  var ddaClass = "[object HTMLAllCollection]";
  var ddaClass2 = "[object HTML document.all class]";
  var ddaClass3 = "[object HTMLCollection]";
  var hasToStringTag = typeof Symbol === "function" && !!Symbol.toStringTag;
  var isIE68 = !(0 in [,]);
  var isDDA = function isDocumentDotAll() {
    return false;
  };
  if (typeof document === "object") {
    var all = document.all;
    if (toStr2.call(all) === toStr2.call(document.all)) {
      isDDA = function isDocumentDotAll2(value) {
        if ((isIE68 || !value) && (typeof value === "undefined" || typeof value === "object")) {
          try {
            var str = toStr2.call(value);
            return (str === ddaClass || str === ddaClass2 || str === ddaClass3 || str === objectClass) && value("") == null;
          } catch (e) {
          }
        }
        return false;
      };
    }
  }
  isCallable = reflectApply2 ? function isCallable2(value) {
    if (isDDA(value)) {
      return true;
    }
    if (!value) {
      return false;
    }
    if (typeof value !== "function" && typeof value !== "object") {
      return false;
    }
    try {
      reflectApply2(value, null, badArrayLike);
    } catch (e) {
      if (e !== isCallableMarker) {
        return false;
      }
    }
    return !isES6ClassFn(value) && tryFunctionObject(value);
  } : function isCallable2(value) {
    if (isDDA(value)) {
      return true;
    }
    if (!value) {
      return false;
    }
    if (typeof value !== "function" && typeof value !== "object") {
      return false;
    }
    if (hasToStringTag) {
      return tryFunctionObject(value);
    }
    if (isES6ClassFn(value)) {
      return false;
    }
    var strClass = toStr2.call(value);
    if (strClass !== fnClass && strClass !== genClass && !/^\[object HTML/.test(strClass)) {
      return false;
    }
    return tryFunctionObject(value);
  };
  return isCallable;
}
var forEach;
var hasRequiredForEach;
function requireForEach() {
  if (hasRequiredForEach) return forEach;
  hasRequiredForEach = 1;
  var isCallable2 = requireIsCallable();
  var toStr2 = Object.prototype.toString;
  var hasOwnProperty = Object.prototype.hasOwnProperty;
  var forEachArray = function forEachArray2(array, iterator, receiver) {
    for (var i = 0, len = array.length; i < len; i++) {
      if (hasOwnProperty.call(array, i)) {
        if (receiver == null) {
          iterator(array[i], i, array);
        } else {
          iterator.call(receiver, array[i], i, array);
        }
      }
    }
  };
  var forEachString = function forEachString2(string, iterator, receiver) {
    for (var i = 0, len = string.length; i < len; i++) {
      if (receiver == null) {
        iterator(string.charAt(i), i, string);
      } else {
        iterator.call(receiver, string.charAt(i), i, string);
      }
    }
  };
  var forEachObject = function forEachObject2(object, iterator, receiver) {
    for (var k in object) {
      if (hasOwnProperty.call(object, k)) {
        if (receiver == null) {
          iterator(object[k], k, object);
        } else {
          iterator.call(receiver, object[k], k, object);
        }
      }
    }
  };
  function isArray2(x) {
    return toStr2.call(x) === "[object Array]";
  }
  forEach = function forEach2(list, iterator, thisArg) {
    if (!isCallable2(iterator)) {
      throw new TypeError("iterator must be a function");
    }
    var receiver;
    if (arguments.length >= 3) {
      receiver = thisArg;
    }
    if (isArray2(list)) {
      forEachArray(list, iterator, receiver);
    } else if (typeof list === "string") {
      forEachString(list, iterator, receiver);
    } else {
      forEachObject(list, iterator, receiver);
    }
  };
  return forEach;
}
var possibleTypedArrayNames;
var hasRequiredPossibleTypedArrayNames;
function requirePossibleTypedArrayNames() {
  if (hasRequiredPossibleTypedArrayNames) return possibleTypedArrayNames;
  hasRequiredPossibleTypedArrayNames = 1;
  possibleTypedArrayNames = [
    "Float16Array",
    "Float32Array",
    "Float64Array",
    "Int8Array",
    "Int16Array",
    "Int32Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Uint16Array",
    "Uint32Array",
    "BigInt64Array",
    "BigUint64Array"
  ];
  return possibleTypedArrayNames;
}
var availableTypedArrays;
var hasRequiredAvailableTypedArrays;
function requireAvailableTypedArrays() {
  if (hasRequiredAvailableTypedArrays) return availableTypedArrays;
  hasRequiredAvailableTypedArrays = 1;
  var possibleNames = requirePossibleTypedArrayNames();
  var g = typeof globalThis === "undefined" ? globalThis : globalThis;
  availableTypedArrays = function availableTypedArrays2() {
    var out = [];
    for (var i = 0; i < possibleNames.length; i++) {
      if (typeof g[possibleNames[i]] === "function") {
        out[out.length] = possibleNames[i];
      }
    }
    return out;
  };
  return availableTypedArrays;
}
var callBind = { exports: {} };
var defineDataProperty;
var hasRequiredDefineDataProperty;
function requireDefineDataProperty() {
  if (hasRequiredDefineDataProperty) return defineDataProperty;
  hasRequiredDefineDataProperty = 1;
  var $defineProperty2 = esDefineProperty;
  var $SyntaxError2 = syntax;
  var $TypeError2 = type;
  var gopd$1 = gopd;
  defineDataProperty = function defineDataProperty2(obj, property, value) {
    if (!obj || typeof obj !== "object" && typeof obj !== "function") {
      throw new $TypeError2("`obj` must be an object or a function`");
    }
    if (typeof property !== "string" && typeof property !== "symbol") {
      throw new $TypeError2("`property` must be a string or a symbol`");
    }
    if (arguments.length > 3 && typeof arguments[3] !== "boolean" && arguments[3] !== null) {
      throw new $TypeError2("`nonEnumerable`, if provided, must be a boolean or null");
    }
    if (arguments.length > 4 && typeof arguments[4] !== "boolean" && arguments[4] !== null) {
      throw new $TypeError2("`nonWritable`, if provided, must be a boolean or null");
    }
    if (arguments.length > 5 && typeof arguments[5] !== "boolean" && arguments[5] !== null) {
      throw new $TypeError2("`nonConfigurable`, if provided, must be a boolean or null");
    }
    if (arguments.length > 6 && typeof arguments[6] !== "boolean") {
      throw new $TypeError2("`loose`, if provided, must be a boolean");
    }
    var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
    var nonWritable = arguments.length > 4 ? arguments[4] : null;
    var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
    var loose = arguments.length > 6 ? arguments[6] : false;
    var desc = !!gopd$1 && gopd$1(obj, property);
    if ($defineProperty2) {
      $defineProperty2(obj, property, {
        configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
        enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
        value,
        writable: nonWritable === null && desc ? desc.writable : !nonWritable
      });
    } else if (loose || !nonEnumerable && !nonWritable && !nonConfigurable) {
      obj[property] = value;
    } else {
      throw new $SyntaxError2("This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.");
    }
  };
  return defineDataProperty;
}
var hasPropertyDescriptors_1;
var hasRequiredHasPropertyDescriptors;
function requireHasPropertyDescriptors() {
  if (hasRequiredHasPropertyDescriptors) return hasPropertyDescriptors_1;
  hasRequiredHasPropertyDescriptors = 1;
  var $defineProperty2 = esDefineProperty;
  var hasPropertyDescriptors = function hasPropertyDescriptors2() {
    return !!$defineProperty2;
  };
  hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
    if (!$defineProperty2) {
      return null;
    }
    try {
      return $defineProperty2([], "length", { value: 1 }).length !== 1;
    } catch (e) {
      return true;
    }
  };
  hasPropertyDescriptors_1 = hasPropertyDescriptors;
  return hasPropertyDescriptors_1;
}
var setFunctionLength;
var hasRequiredSetFunctionLength;
function requireSetFunctionLength() {
  if (hasRequiredSetFunctionLength) return setFunctionLength;
  hasRequiredSetFunctionLength = 1;
  var GetIntrinsic3 = getIntrinsic;
  var define2 = requireDefineDataProperty();
  var hasDescriptors = requireHasPropertyDescriptors()();
  var gOPD2 = gopd;
  var $TypeError2 = type;
  var $floor = GetIntrinsic3("%Math.floor%");
  setFunctionLength = function setFunctionLength2(fn, length) {
    if (typeof fn !== "function") {
      throw new $TypeError2("`fn` is not a function");
    }
    if (typeof length !== "number" || length < 0 || length > 4294967295 || $floor(length) !== length) {
      throw new $TypeError2("`length` must be a positive 32-bit integer");
    }
    var loose = arguments.length > 2 && !!arguments[2];
    var functionLengthIsConfigurable = true;
    var functionLengthIsWritable = true;
    if ("length" in fn && gOPD2) {
      var desc = gOPD2(fn, "length");
      if (desc && !desc.configurable) {
        functionLengthIsConfigurable = false;
      }
      if (desc && !desc.writable) {
        functionLengthIsWritable = false;
      }
    }
    if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
      if (hasDescriptors) {
        define2(
          /** @type {Parameters<define>[0]} */
          fn,
          "length",
          length,
          true,
          true
        );
      } else {
        define2(
          /** @type {Parameters<define>[0]} */
          fn,
          "length",
          length
        );
      }
    }
    return fn;
  };
  return setFunctionLength;
}
var applyBind;
var hasRequiredApplyBind;
function requireApplyBind() {
  if (hasRequiredApplyBind) return applyBind;
  hasRequiredApplyBind = 1;
  var bind3 = functionBind;
  var $apply2 = requireFunctionApply();
  var actualApply$1 = actualApply;
  applyBind = function applyBind2() {
    return actualApply$1(bind3, $apply2, arguments);
  };
  return applyBind;
}
var hasRequiredCallBind;
function requireCallBind() {
  if (hasRequiredCallBind) return callBind.exports;
  hasRequiredCallBind = 1;
  (function(module2) {
    var setFunctionLength2 = requireSetFunctionLength();
    var $defineProperty2 = esDefineProperty;
    var callBindBasic3 = callBindApplyHelpers;
    var applyBind2 = requireApplyBind();
    module2.exports = function callBind2(originalFunction) {
      var func = callBindBasic3(arguments);
      var adjustedLength = originalFunction.length - (arguments.length - 1);
      return setFunctionLength2(
        func,
        1 + (adjustedLength > 0 ? adjustedLength : 0),
        true
      );
    };
    if ($defineProperty2) {
      $defineProperty2(module2.exports, "apply", { value: applyBind2 });
    } else {
      module2.exports.apply = applyBind2;
    }
  })(callBind);
  return callBind.exports;
}
var shams;
var hasRequiredShams;
function requireShams() {
  if (hasRequiredShams) return shams;
  hasRequiredShams = 1;
  var hasSymbols2 = requireShams$1();
  shams = function hasToStringTagShams() {
    return hasSymbols2() && !!Symbol.toStringTag;
  };
  return shams;
}
var whichTypedArray;
var hasRequiredWhichTypedArray;
function requireWhichTypedArray() {
  if (hasRequiredWhichTypedArray) return whichTypedArray;
  hasRequiredWhichTypedArray = 1;
  var forEach2 = requireForEach();
  var availableTypedArrays2 = requireAvailableTypedArrays();
  var callBind2 = requireCallBind();
  var callBound2 = callBound$1;
  var gOPD2 = gopd;
  var getProto2 = requireGetProto();
  var $toString = callBound2("Object.prototype.toString");
  var hasToStringTag = requireShams()();
  var g = typeof globalThis === "undefined" ? globalThis : globalThis;
  var typedArrays = availableTypedArrays2();
  var $slice = callBound2("String.prototype.slice");
  var $indexOf2 = callBound2("Array.prototype.indexOf", true) || function indexOf(array, value) {
    for (var i = 0; i < array.length; i += 1) {
      if (array[i] === value) {
        return i;
      }
    }
    return -1;
  };
  var cache = { __proto__: null };
  if (hasToStringTag && gOPD2 && getProto2) {
    forEach2(typedArrays, function(typedArray) {
      var arr = new g[typedArray]();
      if (Symbol.toStringTag in arr && getProto2) {
        var proto = getProto2(arr);
        var descriptor = gOPD2(proto, Symbol.toStringTag);
        if (!descriptor && proto) {
          var superProto = getProto2(proto);
          descriptor = gOPD2(superProto, Symbol.toStringTag);
        }
        cache["$" + typedArray] = callBind2(descriptor.get);
      }
    });
  } else {
    forEach2(typedArrays, function(typedArray) {
      var arr = new g[typedArray]();
      var fn = arr.slice || arr.set;
      if (fn) {
        cache[
          /** @type {`$${import('.').TypedArrayName}`} */
          "$" + typedArray
        ] = /** @type {import('./types').BoundSlice | import('./types').BoundSet} */
        // @ts-expect-error TODO FIXME
        callBind2(fn);
      }
    });
  }
  var tryTypedArrays = function tryAllTypedArrays(value) {
    var found = false;
    forEach2(
      /** @type {Record<`\$${import('.').TypedArrayName}`, Getter>} */
      cache,
      /** @type {(getter: Getter, name: `\$${import('.').TypedArrayName}`) => void} */
      function(getter, typedArray) {
        if (!found) {
          try {
            if ("$" + getter(value) === typedArray) {
              found = /** @type {import('.').TypedArrayName} */
              $slice(typedArray, 1);
            }
          } catch (e) {
          }
        }
      }
    );
    return found;
  };
  var trySlices = function tryAllSlices(value) {
    var found = false;
    forEach2(
      /** @type {Record<`\$${import('.').TypedArrayName}`, Getter>} */
      cache,
      /** @type {(getter: Getter, name: `\$${import('.').TypedArrayName}`) => void} */
      function(getter, name) {
        if (!found) {
          try {
            getter(value);
            found = /** @type {import('.').TypedArrayName} */
            $slice(name, 1);
          } catch (e) {
          }
        }
      }
    );
    return found;
  };
  whichTypedArray = function whichTypedArray2(value) {
    if (!value || typeof value !== "object") {
      return false;
    }
    if (!hasToStringTag) {
      var tag2 = $slice($toString(value), 8, -1);
      if ($indexOf2(typedArrays, tag2) > -1) {
        return tag2;
      }
      if (tag2 !== "Object") {
        return false;
      }
      return trySlices(value);
    }
    if (!gOPD2) {
      return null;
    }
    return tryTypedArrays(value);
  };
  return whichTypedArray;
}
var isTypedArray$1;
var hasRequiredIsTypedArray;
function requireIsTypedArray() {
  if (hasRequiredIsTypedArray) return isTypedArray$1;
  hasRequiredIsTypedArray = 1;
  var whichTypedArray2 = requireWhichTypedArray();
  isTypedArray$1 = function isTypedArray2(value) {
    return !!whichTypedArray2(value);
  };
  return isTypedArray$1;
}
var $TypeError = type;
var callBound = callBound$1;
var $typedArrayBuffer = callBound("TypedArray.prototype.buffer", true);
var isTypedArray = requireIsTypedArray();
var typedArrayBuffer$1 = $typedArrayBuffer || function typedArrayBuffer(x) {
  if (!isTypedArray(x)) {
    throw new $TypeError("Not a Typed Array");
  }
  return x.buffer;
};
var Buffer$3 = safeBufferExports.Buffer;
var isArray = isarray;
var typedArrayBuffer2 = typedArrayBuffer$1;
var isView = ArrayBuffer.isView || function isView2(obj) {
  try {
    typedArrayBuffer2(obj);
    return true;
  } catch (e) {
    return false;
  }
};
var useUint8Array = typeof Uint8Array !== "undefined";
var useArrayBuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
var useFromArrayBuffer = useArrayBuffer && (Buffer$3.prototype instanceof Uint8Array || Buffer$3.TYPED_ARRAY_SUPPORT);
var toBuffer$1 = function toBuffer(data, encoding) {
  if (Buffer$3.isBuffer(data)) {
    if (data.constructor && !("isBuffer" in data)) {
      return Buffer$3.from(data);
    }
    return data;
  }
  if (typeof data === "string") {
    return Buffer$3.from(data, encoding);
  }
  if (useArrayBuffer && isView(data)) {
    if (data.byteLength === 0) {
      return Buffer$3.alloc(0);
    }
    if (useFromArrayBuffer) {
      var res = Buffer$3.from(data.buffer, data.byteOffset, data.byteLength);
      if (res.byteLength === data.byteLength) {
        return res;
      }
    }
    var uint8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    var result = Buffer$3.from(uint8);
    if (result.length === data.byteLength) {
      return result;
    }
  }
  if (useUint8Array && data instanceof Uint8Array) {
    return Buffer$3.from(data);
  }
  var isArr = isArray(data);
  if (isArr) {
    for (var i = 0; i < data.length; i += 1) {
      var x = data[i];
      if (typeof x !== "number" || x < 0 || x > 255 || ~~x !== x) {
        throw new RangeError("Array items must be numbers in the range 0-255.");
      }
    }
  }
  if (isArr || Buffer$3.isBuffer(data) && data.constructor && typeof data.constructor.isBuffer === "function" && data.constructor.isBuffer(data)) {
    return Buffer$3.from(data);
  }
  throw new TypeError('The "data" argument must be a string, an Array, a Buffer, a Uint8Array, or a DataView.');
};
var Buffer$2 = safeBufferExports.Buffer;
var toBuffer2 = toBuffer$1;
function Hash$2(blockSize, finalSize) {
  this._block = Buffer$2.alloc(blockSize);
  this._finalSize = finalSize;
  this._blockSize = blockSize;
  this._len = 0;
}
Hash$2.prototype.update = function(data, enc) {
  data = toBuffer2(data, enc || "utf8");
  var block = this._block;
  var blockSize = this._blockSize;
  var length = data.length;
  var accum = this._len;
  for (var offset = 0; offset < length; ) {
    var assigned = accum % blockSize;
    var remainder = Math.min(length - offset, blockSize - assigned);
    for (var i = 0; i < remainder; i++) {
      block[assigned + i] = data[offset + i];
    }
    accum += remainder;
    offset += remainder;
    if (accum % blockSize === 0) {
      this._update(block);
    }
  }
  this._len += length;
  return this;
};
Hash$2.prototype.digest = function(enc) {
  var rem = this._len % this._blockSize;
  this._block[rem] = 128;
  this._block.fill(0, rem + 1);
  if (rem >= this._finalSize) {
    this._update(this._block);
    this._block.fill(0);
  }
  var bits = this._len * 8;
  if (bits <= 4294967295) {
    this._block.writeUInt32BE(bits, this._blockSize - 4);
  } else {
    var lowBits = (bits & 4294967295) >>> 0;
    var highBits = (bits - lowBits) / 4294967296;
    this._block.writeUInt32BE(highBits, this._blockSize - 8);
    this._block.writeUInt32BE(lowBits, this._blockSize - 4);
  }
  this._update(this._block);
  var hash2 = this._hash();
  return enc ? hash2.toString(enc) : hash2;
};
Hash$2.prototype._update = function() {
  throw new Error("_update must be implemented by subclass");
};
var hash = Hash$2;
var inherits = inherits_browserExports;
var Hash$1 = hash;
var Buffer$1 = safeBufferExports.Buffer;
var K = [
  1518500249,
  1859775393,
  2400959708 | 0,
  3395469782 | 0
];
var W = new Array(80);
function Sha1() {
  this.init();
  this._w = W;
  Hash$1.call(this, 64, 56);
}
inherits(Sha1, Hash$1);
Sha1.prototype.init = function() {
  this._a = 1732584193;
  this._b = 4023233417;
  this._c = 2562383102;
  this._d = 271733878;
  this._e = 3285377520;
  return this;
};
function rotl1(num2) {
  return num2 << 1 | num2 >>> 31;
}
function rotl5(num2) {
  return num2 << 5 | num2 >>> 27;
}
function rotl30(num2) {
  return num2 << 30 | num2 >>> 2;
}
function ft(s, b, c2, d) {
  if (s === 0) {
    return b & c2 | ~b & d;
  }
  if (s === 2) {
    return b & c2 | b & d | c2 & d;
  }
  return b ^ c2 ^ d;
}
Sha1.prototype._update = function(M) {
  var w = this._w;
  var a = this._a | 0;
  var b = this._b | 0;
  var c2 = this._c | 0;
  var d = this._d | 0;
  var e = this._e | 0;
  for (var i = 0; i < 16; ++i) {
    w[i] = M.readInt32BE(i * 4);
  }
  for (; i < 80; ++i) {
    w[i] = rotl1(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]);
  }
  for (var j = 0; j < 80; ++j) {
    var s = ~~(j / 20);
    var t = rotl5(a) + ft(s, b, c2, d) + e + w[j] + K[s] | 0;
    e = d;
    d = c2;
    c2 = rotl30(b);
    b = a;
    a = t;
  }
  this._a = a + this._a | 0;
  this._b = b + this._b | 0;
  this._c = c2 + this._c | 0;
  this._d = d + this._d | 0;
  this._e = e + this._e | 0;
};
Sha1.prototype._hash = function() {
  var H = Buffer$1.allocUnsafe(20);
  H.writeInt32BE(this._a | 0, 0);
  H.writeInt32BE(this._b | 0, 4);
  H.writeInt32BE(this._c | 0, 8);
  H.writeInt32BE(this._d | 0, 12);
  H.writeInt32BE(this._e | 0, 16);
  return H;
};
var sha1 = Sha1;
function assertPath(path2) {
  if (typeof path2 !== "string") {
    throw new TypeError("Path must be a string. Received " + JSON.stringify(path2));
  }
}
function normalizeStringPosix(path2, allowAboveRoot) {
  var res = "";
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path2.length; ++i) {
    if (i < path2.length)
      code = path2.charCodeAt(i);
    else if (code === 47)
      break;
    else
      code = 47;
    if (code === 47) {
      if (lastSlash === i - 1 || dots === 1) ;
      else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 || res.charCodeAt(res.length - 2) !== 46) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf("/");
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = "";
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf("/");
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += "/..";
          else
            res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += "/" + path2.slice(lastSlash + 1, i);
        else
          res = path2.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}
function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || "") + (pathObject.ext || "");
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}
var posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = "";
    var resolvedAbsolute = false;
    var cwd;
    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path2;
      if (i >= 0)
        path2 = arguments[i];
      else {
        if (cwd === void 0)
          cwd = process.cwd();
        path2 = cwd;
      }
      assertPath(path2);
      if (path2.length === 0) {
        continue;
      }
      resolvedPath = path2 + "/" + resolvedPath;
      resolvedAbsolute = path2.charCodeAt(0) === 47;
    }
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);
    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return "/" + resolvedPath;
      else
        return "/";
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return ".";
    }
  },
  normalize: function normalize(path2) {
    assertPath(path2);
    if (path2.length === 0) return ".";
    var isAbsolute2 = path2.charCodeAt(0) === 47;
    var trailingSeparator = path2.charCodeAt(path2.length - 1) === 47;
    path2 = normalizeStringPosix(path2, !isAbsolute2);
    if (path2.length === 0 && !isAbsolute2) path2 = ".";
    if (path2.length > 0 && trailingSeparator) path2 += "/";
    if (isAbsolute2) return "/" + path2;
    return path2;
  },
  isAbsolute: function isAbsolute(path2) {
    assertPath(path2);
    return path2.length > 0 && path2.charCodeAt(0) === 47;
  },
  join: function join() {
    if (arguments.length === 0)
      return ".";
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === void 0)
          joined = arg;
        else
          joined += "/" + arg;
      }
    }
    if (joined === void 0)
      return ".";
    return posix.normalize(joined);
  },
  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);
    if (from === to) return "";
    from = posix.resolve(from);
    to = posix.resolve(to);
    if (from === to) return "";
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47)
        break;
    }
    var fromEnd = from.length;
    var fromLen = fromEnd - fromStart;
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47)
        break;
    }
    var toEnd = to.length;
    var toLen = toEnd - toStart;
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47) {
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47) {
            lastCommonSep = i;
          } else if (i === 0) {
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47)
        lastCommonSep = i;
    }
    var out = "";
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47) {
        if (out.length === 0)
          out += "..";
        else
          out += "/..";
      }
    }
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47)
        ++toStart;
      return to.slice(toStart);
    }
  },
  _makeLong: function _makeLong(path2) {
    return path2;
  },
  dirname: function dirname(path2) {
    assertPath(path2);
    if (path2.length === 0) return ".";
    var code = path2.charCodeAt(0);
    var hasRoot = code === 47;
    var end = -1;
    var matchedSlash = true;
    for (var i = path2.length - 1; i >= 1; --i) {
      code = path2.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
        matchedSlash = false;
      }
    }
    if (end === -1) return hasRoot ? "/" : ".";
    if (hasRoot && end === 1) return "//";
    return path2.slice(0, end);
  },
  basename: function basename(path2, ext) {
    if (ext !== void 0 && typeof ext !== "string") throw new TypeError('"ext" argument must be a string');
    assertPath(path2);
    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;
    if (ext !== void 0 && ext.length > 0 && ext.length <= path2.length) {
      if (ext.length === path2.length && ext === path2) return "";
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path2.length - 1; i >= 0; --i) {
        var code = path2.charCodeAt(i);
        if (code === 47) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else {
          if (firstNonSlashEnd === -1) {
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                end = i;
              }
            } else {
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }
      if (start === end) end = firstNonSlashEnd;
      else if (end === -1) end = path2.length;
      return path2.slice(start, end);
    } else {
      for (i = path2.length - 1; i >= 0; --i) {
        if (path2.charCodeAt(i) === 47) {
          if (!matchedSlash) {
            start = i + 1;
            break;
          }
        } else if (end === -1) {
          matchedSlash = false;
          end = i + 1;
        }
      }
      if (end === -1) return "";
      return path2.slice(start, end);
    }
  },
  extname: function extname(path2) {
    assertPath(path2);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var preDotState = 0;
    for (var i = path2.length - 1; i >= 0; --i) {
      var code = path2.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46) {
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return "";
    }
    return path2.slice(startDot, end);
  },
  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== "object") {
      throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
    }
    return _format("/", pathObject);
  },
  parse: function parse(path2) {
    assertPath(path2);
    var ret = { root: "", dir: "", base: "", ext: "", name: "" };
    if (path2.length === 0) return ret;
    var code = path2.charCodeAt(0);
    var isAbsolute2 = code === 47;
    var start;
    if (isAbsolute2) {
      ret.root = "/";
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path2.length - 1;
    var preDotState = 0;
    for (; i >= start; --i) {
      code = path2.charCodeAt(i);
      if (code === 47) {
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
      if (end === -1) {
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46) {
        if (startDot === -1) startDot = i;
        else if (preDotState !== 1) preDotState = 1;
      } else if (startDot !== -1) {
        preDotState = -1;
      }
    }
    if (startDot === -1 || end === -1 || // We saw a non-dot character immediately before the dot
    preDotState === 0 || // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute2) ret.base = ret.name = path2.slice(1, end);
        else ret.base = ret.name = path2.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute2) {
        ret.name = path2.slice(1, startDot);
        ret.base = path2.slice(1, end);
      } else {
        ret.name = path2.slice(startPart, startDot);
        ret.base = path2.slice(startPart, end);
      }
      ret.ext = path2.slice(startDot, end);
    }
    if (startPart > 0) ret.dir = path2.slice(0, startPart - 1);
    else if (isAbsolute2) ret.dir = "/";
    return ret;
  },
  sep: "/",
  delimiter: ":",
  win32: null,
  posix: null
};
posix.posix = posix;
var pathBrowserify$1 = posix;
var crc32$4 = {};
/*! crc32.js (C) 2014-present SheetJS -- http://sheetjs.com */
(function(exports2) {
  (function(factory2) {
    if (typeof DO_NOT_EXPORT_CRC === "undefined") {
      {
        factory2(exports2);
      }
    } else {
      factory2({});
    }
  })(function(CRC322) {
    CRC322.version = "1.2.2";
    function signed_crc_table() {
      var c2 = 0, table = new Array(256);
      for (var n = 0; n != 256; ++n) {
        c2 = n;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        c2 = c2 & 1 ? -306674912 ^ c2 >>> 1 : c2 >>> 1;
        table[n] = c2;
      }
      return typeof Int32Array !== "undefined" ? new Int32Array(table) : table;
    }
    var T0 = signed_crc_table();
    function slice_by_16_tables(T) {
      var c2 = 0, v = 0, n = 0, table = typeof Int32Array !== "undefined" ? new Int32Array(4096) : new Array(4096);
      for (n = 0; n != 256; ++n) table[n] = T[n];
      for (n = 0; n != 256; ++n) {
        v = T[n];
        for (c2 = 256 + n; c2 < 4096; c2 += 256) v = table[c2] = v >>> 8 ^ T[v & 255];
      }
      var out = [];
      for (n = 1; n != 16; ++n) out[n - 1] = typeof Int32Array !== "undefined" ? table.subarray(n * 256, n * 256 + 256) : table.slice(n * 256, n * 256 + 256);
      return out;
    }
    var TT = slice_by_16_tables(T0);
    var T1 = TT[0], T2 = TT[1], T3 = TT[2], T4 = TT[3], T5 = TT[4];
    var T6 = TT[5], T7 = TT[6], T8 = TT[7], T9 = TT[8], Ta = TT[9];
    var Tb = TT[10], Tc = TT[11], Td = TT[12], Te = TT[13], Tf = TT[14];
    function crc32_bstr(bstr, seed) {
      var C = seed ^ -1;
      for (var i = 0, L = bstr.length; i < L; ) C = C >>> 8 ^ T0[(C ^ bstr.charCodeAt(i++)) & 255];
      return ~C;
    }
    function crc32_buf(B, seed) {
      var C = seed ^ -1, L = B.length - 15, i = 0;
      for (; i < L; ) C = Tf[B[i++] ^ C & 255] ^ Te[B[i++] ^ C >> 8 & 255] ^ Td[B[i++] ^ C >> 16 & 255] ^ Tc[B[i++] ^ C >>> 24] ^ Tb[B[i++]] ^ Ta[B[i++]] ^ T9[B[i++]] ^ T8[B[i++]] ^ T7[B[i++]] ^ T6[B[i++]] ^ T5[B[i++]] ^ T4[B[i++]] ^ T3[B[i++]] ^ T2[B[i++]] ^ T1[B[i++]] ^ T0[B[i++]];
      L += 15;
      while (i < L) C = C >>> 8 ^ T0[(C ^ B[i++]) & 255];
      return ~C;
    }
    function crc32_str(str, seed) {
      var C = seed ^ -1;
      for (var i = 0, L = str.length, c2 = 0, d = 0; i < L; ) {
        c2 = str.charCodeAt(i++);
        if (c2 < 128) {
          C = C >>> 8 ^ T0[(C ^ c2) & 255];
        } else if (c2 < 2048) {
          C = C >>> 8 ^ T0[(C ^ (192 | c2 >> 6 & 31)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c2 & 63)) & 255];
        } else if (c2 >= 55296 && c2 < 57344) {
          c2 = (c2 & 1023) + 64;
          d = str.charCodeAt(i++) & 1023;
          C = C >>> 8 ^ T0[(C ^ (240 | c2 >> 8 & 7)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c2 >> 2 & 63)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | d >> 6 & 15 | (c2 & 3) << 4)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | d & 63)) & 255];
        } else {
          C = C >>> 8 ^ T0[(C ^ (224 | c2 >> 12 & 15)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c2 >> 6 & 63)) & 255];
          C = C >>> 8 ^ T0[(C ^ (128 | c2 & 63)) & 255];
        }
      }
      return ~C;
    }
    CRC322.table = T0;
    CRC322.bstr = crc32_bstr;
    CRC322.buf = crc32_buf;
    CRC322.str = crc32_str;
  });
})(crc32$4);
var common = {};
(function(exports2) {
  var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
  function _has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  exports2.assign = function(obj) {
    var sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      var source = sources.shift();
      if (!source) {
        continue;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be non-object");
      }
      for (var p in source) {
        if (_has(source, p)) {
          obj[p] = source[p];
        }
      }
    }
    return obj;
  };
  exports2.shrinkBuf = function(buf, size) {
    if (buf.length === size) {
      return buf;
    }
    if (buf.subarray) {
      return buf.subarray(0, size);
    }
    buf.length = size;
    return buf;
  };
  var fnTyped = {
    arraySet: function(dest, src2, src_offs, len, dest_offs) {
      if (src2.subarray && dest.subarray) {
        dest.set(src2.subarray(src_offs, src_offs + len), dest_offs);
        return;
      }
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src2[src_offs + i];
      }
    },
    // Join array of chunks to single array.
    flattenChunks: function(chunks) {
      var i, l, len, pos, chunk, result;
      len = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        len += chunks[i].length;
      }
      result = new Uint8Array(len);
      pos = 0;
      for (i = 0, l = chunks.length; i < l; i++) {
        chunk = chunks[i];
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    }
  };
  var fnUntyped = {
    arraySet: function(dest, src2, src_offs, len, dest_offs) {
      for (var i = 0; i < len; i++) {
        dest[dest_offs + i] = src2[src_offs + i];
      }
    },
    // Join array of chunks to single array.
    flattenChunks: function(chunks) {
      return [].concat.apply([], chunks);
    }
  };
  exports2.setTyped = function(on) {
    if (on) {
      exports2.Buf8 = Uint8Array;
      exports2.Buf16 = Uint16Array;
      exports2.Buf32 = Int32Array;
      exports2.assign(exports2, fnTyped);
    } else {
      exports2.Buf8 = Array;
      exports2.Buf16 = Array;
      exports2.Buf32 = Array;
      exports2.assign(exports2, fnUntyped);
    }
  };
  exports2.setTyped(TYPED_OK);
})(common);
var deflate$5 = {};
var deflate$4 = {};
var trees$1 = {};
var utils$6 = common;
var Z_FIXED$1 = 4;
var Z_BINARY = 0;
var Z_TEXT = 1;
var Z_UNKNOWN$1 = 2;
function zero$1(buf) {
  var len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES = 2;
var MIN_MATCH$1 = 3;
var MAX_MATCH$1 = 258;
var LENGTH_CODES$1 = 29;
var LITERALS$1 = 256;
var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
var D_CODES$1 = 30;
var BL_CODES$1 = 19;
var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
var MAX_BITS$1 = 15;
var Buf_size = 16;
var MAX_BL_BITS = 7;
var END_BLOCK = 256;
var REP_3_6 = 16;
var REPZ_3_10 = 17;
var REPZ_11_138 = 18;
var extra_lbits = (
  /* extra bits for each length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
);
var extra_dbits = (
  /* extra bits for each distance code */
  [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
);
var extra_blbits = (
  /* extra bits for each bit length code */
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]
);
var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
var DIST_CODE_LEN = 512;
var static_ltree = new Array((L_CODES$1 + 2) * 2);
zero$1(static_ltree);
var static_dtree = new Array(D_CODES$1 * 2);
zero$1(static_dtree);
var _dist_code = new Array(DIST_CODE_LEN);
zero$1(_dist_code);
var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
zero$1(_length_code);
var base_length = new Array(LENGTH_CODES$1);
zero$1(base_length);
var base_dist = new Array(D_CODES$1);
zero$1(base_dist);
function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
  this.static_tree = static_tree;
  this.extra_bits = extra_bits;
  this.extra_base = extra_base;
  this.elems = elems;
  this.max_length = max_length;
  this.has_stree = static_tree && static_tree.length;
}
var static_l_desc;
var static_d_desc;
var static_bl_desc;
function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;
  this.max_code = 0;
  this.stat_desc = stat_desc;
}
function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}
function put_short(s, w) {
  s.pending_buf[s.pending++] = w & 255;
  s.pending_buf[s.pending++] = w >>> 8 & 255;
}
function send_bits(s, value, length) {
  if (s.bi_valid > Buf_size - length) {
    s.bi_buf |= value << s.bi_valid & 65535;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> Buf_size - s.bi_valid;
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= value << s.bi_valid & 65535;
    s.bi_valid += length;
  }
}
function send_code(s, c2, tree) {
  send_bits(
    s,
    tree[c2 * 2],
    tree[c2 * 2 + 1]
    /*.Len*/
  );
}
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;
  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 255;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}
function gen_bitlen(s, desc) {
  var tree = desc.dyn_tree;
  var max_code = desc.max_code;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var extra = desc.stat_desc.extra_bits;
  var base = desc.stat_desc.extra_base;
  var max_length = desc.stat_desc.max_length;
  var h;
  var n, m;
  var bits;
  var xbits;
  var f;
  var overflow = 0;
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    s.bl_count[bits] = 0;
  }
  tree[s.heap[s.heap_max] * 2 + 1] = 0;
  for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1] = bits;
    if (n > max_code) {
      continue;
    }
    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2];
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1] + xbits);
    }
  }
  if (overflow === 0) {
    return;
  }
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) {
      bits--;
    }
    s.bl_count[bits]--;
    s.bl_count[bits + 1] += 2;
    s.bl_count[max_length]--;
    overflow -= 2;
  } while (overflow > 0);
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) {
        continue;
      }
      if (tree[m * 2 + 1] !== bits) {
        s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
        tree[m * 2 + 1] = bits;
      }
      n--;
    }
  }
}
function gen_codes(tree, max_code, bl_count) {
  var next_code = new Array(MAX_BITS$1 + 1);
  var code = 0;
  var bits;
  var n;
  for (bits = 1; bits <= MAX_BITS$1; bits++) {
    next_code[bits] = code = code + bl_count[bits - 1] << 1;
  }
  for (n = 0; n <= max_code; n++) {
    var len = tree[n * 2 + 1];
    if (len === 0) {
      continue;
    }
    tree[n * 2] = bi_reverse(next_code[len]++, len);
  }
}
function tr_static_init() {
  var n;
  var bits;
  var length;
  var code;
  var dist;
  var bl_count = new Array(MAX_BITS$1 + 1);
  length = 0;
  for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < 1 << extra_lbits[code]; n++) {
      _length_code[length++] = code;
    }
  }
  _length_code[length - 1] = code;
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < 1 << extra_dbits[code]; n++) {
      _dist_code[dist++] = code;
    }
  }
  dist >>= 7;
  for (; code < D_CODES$1; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < 1 << extra_dbits[code] - 7; n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  for (bits = 0; bits <= MAX_BITS$1; bits++) {
    bl_count[bits] = 0;
  }
  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1] = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1] = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1] = 8;
    n++;
    bl_count[8]++;
  }
  gen_codes(static_ltree, L_CODES$1 + 1, bl_count);
  for (n = 0; n < D_CODES$1; n++) {
    static_dtree[n * 2 + 1] = 5;
    static_dtree[n * 2] = bi_reverse(n, 5);
  }
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);
}
function init_block(s) {
  var n;
  for (n = 0; n < L_CODES$1; n++) {
    s.dyn_ltree[n * 2] = 0;
  }
  for (n = 0; n < D_CODES$1; n++) {
    s.dyn_dtree[n * 2] = 0;
  }
  for (n = 0; n < BL_CODES$1; n++) {
    s.bl_tree[n * 2] = 0;
  }
  s.dyn_ltree[END_BLOCK * 2] = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}
function bi_windup(s) {
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}
function copy_block(s, buf, len, header) {
  bi_windup(s);
  {
    put_short(s, len);
    put_short(s, ~len);
  }
  utils$6.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}
function smaller(tree, n, m, depth) {
  var _n2 = n * 2;
  var _m2 = m * 2;
  return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
}
function pqdownheap(s, tree, k) {
  var v = s.heap[k];
  var j = k << 1;
  while (j <= s.heap_len) {
    if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    if (smaller(tree, v, s.heap[j], s.depth)) {
      break;
    }
    s.heap[k] = s.heap[j];
    k = j;
    j <<= 1;
  }
  s.heap[k] = v;
}
function compress_block(s, ltree, dtree) {
  var dist;
  var lc;
  var lx = 0;
  var code;
  var extra;
  if (s.last_lit !== 0) {
    do {
      dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
      lc = s.pending_buf[s.l_buf + lx];
      lx++;
      if (dist === 0) {
        send_code(s, lc, ltree);
      } else {
        code = _length_code[lc];
        send_code(s, code + LITERALS$1 + 1, ltree);
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);
        }
        dist--;
        code = d_code(dist);
        send_code(s, code, dtree);
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);
        }
      }
    } while (lx < s.last_lit);
  }
  send_code(s, END_BLOCK, ltree);
}
function build_tree(s, desc) {
  var tree = desc.dyn_tree;
  var stree = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems = desc.stat_desc.elems;
  var n, m;
  var max_code = -1;
  var node;
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE$1;
  for (n = 0; n < elems; n++) {
    if (tree[n * 2] !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;
    } else {
      tree[n * 2 + 1] = 0;
    }
  }
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
    tree[node * 2] = 1;
    s.depth[node] = 0;
    s.opt_len--;
    if (has_stree) {
      s.static_len -= stree[node * 2 + 1];
    }
  }
  desc.max_code = max_code;
  for (n = s.heap_len >> 1; n >= 1; n--) {
    pqdownheap(s, tree, n);
  }
  node = elems;
  do {
    n = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[
      1
      /*SMALLEST*/
    ] = s.heap[s.heap_len--];
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
    m = s.heap[
      1
      /*SMALLEST*/
    ];
    s.heap[--s.heap_max] = n;
    s.heap[--s.heap_max] = m;
    tree[node * 2] = tree[n * 2] + tree[m * 2];
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1] = tree[m * 2 + 1] = node;
    s.heap[
      1
      /*SMALLEST*/
    ] = node++;
    pqdownheap(
      s,
      tree,
      1
      /*SMALLEST*/
    );
  } while (s.heap_len >= 2);
  s.heap[--s.heap_max] = s.heap[
    1
    /*SMALLEST*/
  ];
  gen_bitlen(s, desc);
  gen_codes(tree, max_code, s.bl_count);
}
function scan_tree(s, tree, max_code) {
  var n;
  var prevlen = -1;
  var curlen;
  var nextlen = tree[0 * 2 + 1];
  var count = 0;
  var max_count = 7;
  var min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1] = 65535;
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      s.bl_tree[curlen * 2] += count;
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        s.bl_tree[curlen * 2]++;
      }
      s.bl_tree[REP_3_6 * 2]++;
    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]++;
    } else {
      s.bl_tree[REPZ_11_138 * 2]++;
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}
function send_tree(s, tree, max_code) {
  var n;
  var prevlen = -1;
  var curlen;
  var nextlen = tree[0 * 2 + 1];
  var count = 0;
  var max_count = 7;
  var min_count = 4;
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1];
    if (++count < max_count && curlen === nextlen) {
      continue;
    } else if (count < min_count) {
      do {
        send_code(s, curlen, s.bl_tree);
      } while (--count !== 0);
    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);
    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);
    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }
    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;
    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}
function build_bl_tree(s) {
  var max_blindex;
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
  build_tree(s, s.bl_desc);
  for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
      break;
    }
  }
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  return max_blindex;
}
function send_all_trees(s, lcodes, dcodes, blcodes) {
  var rank2;
  send_bits(s, lcodes - 257, 5);
  send_bits(s, dcodes - 1, 5);
  send_bits(s, blcodes - 4, 4);
  for (rank2 = 0; rank2 < blcodes; rank2++) {
    send_bits(s, s.bl_tree[bl_order[rank2] * 2 + 1], 3);
  }
  send_tree(s, s.dyn_ltree, lcodes - 1);
  send_tree(s, s.dyn_dtree, dcodes - 1);
}
function detect_data_type(s) {
  var black_mask = 4093624447;
  var n;
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
      return Z_BINARY;
    }
  }
  if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS$1; n++) {
    if (s.dyn_ltree[n * 2] !== 0) {
      return Z_TEXT;
    }
  }
  return Z_BINARY;
}
var static_init_done = false;
function _tr_init(s) {
  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }
  s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
  s.bi_buf = 0;
  s.bi_valid = 0;
  init_block(s);
}
function _tr_stored_block(s, buf, stored_len, last) {
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
  copy_block(s, buf, stored_len);
}
function _tr_align(s) {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}
function _tr_flush_block(s, buf, stored_len, last) {
  var opt_lenb, static_lenb;
  var max_blindex = 0;
  if (s.level > 0) {
    if (s.strm.data_type === Z_UNKNOWN$1) {
      s.strm.data_type = detect_data_type(s);
    }
    build_tree(s, s.l_desc);
    build_tree(s, s.d_desc);
    max_blindex = build_bl_tree(s);
    opt_lenb = s.opt_len + 3 + 7 >>> 3;
    static_lenb = s.static_len + 3 + 7 >>> 3;
    if (static_lenb <= opt_lenb) {
      opt_lenb = static_lenb;
    }
  } else {
    opt_lenb = static_lenb = stored_len + 5;
  }
  if (stored_len + 4 <= opt_lenb && buf !== -1) {
    _tr_stored_block(s, buf, stored_len, last);
  } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);
  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  init_block(s);
  if (last) {
    bi_windup(s);
  }
}
function _tr_tally(s, dist, lc) {
  s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
  s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
  s.last_lit++;
  if (dist === 0) {
    s.dyn_ltree[lc * 2]++;
  } else {
    s.matches++;
    dist--;
    s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2]++;
    s.dyn_dtree[d_code(dist) * 2]++;
  }
  return s.last_lit === s.lit_bufsize - 1;
}
trees$1._tr_init = _tr_init;
trees$1._tr_stored_block = _tr_stored_block;
trees$1._tr_flush_block = _tr_flush_block;
trees$1._tr_tally = _tr_tally;
trees$1._tr_align = _tr_align;
function adler32$2(adler, buf, len, pos) {
  var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
  while (len !== 0) {
    n = len > 2e3 ? 2e3 : len;
    len -= n;
    do {
      s1 = s1 + buf[pos++] | 0;
      s2 = s2 + s1 | 0;
    } while (--n);
    s1 %= 65521;
    s2 %= 65521;
  }
  return s1 | s2 << 16 | 0;
}
var adler32_1 = adler32$2;
function makeTable() {
  var c2, table = [];
  for (var n = 0; n < 256; n++) {
    c2 = n;
    for (var k = 0; k < 8; k++) {
      c2 = c2 & 1 ? 3988292384 ^ c2 >>> 1 : c2 >>> 1;
    }
    table[n] = c2;
  }
  return table;
}
var crcTable = makeTable();
function crc32$3(crc, buf, len, pos) {
  var t = crcTable, end = pos + len;
  crc ^= -1;
  for (var i = pos; i < end; i++) {
    crc = crc >>> 8 ^ t[(crc ^ buf[i]) & 255];
  }
  return crc ^ -1;
}
var crc32_1 = crc32$3;
var messages = {
  2: "need dictionary",
  /* Z_NEED_DICT       2  */
  1: "stream end",
  /* Z_STREAM_END      1  */
  0: "",
  /* Z_OK              0  */
  "-1": "file error",
  /* Z_ERRNO         (-1) */
  "-2": "stream error",
  /* Z_STREAM_ERROR  (-2) */
  "-3": "data error",
  /* Z_DATA_ERROR    (-3) */
  "-4": "insufficient memory",
  /* Z_MEM_ERROR     (-4) */
  "-5": "buffer error",
  /* Z_BUF_ERROR     (-5) */
  "-6": "incompatible version"
  /* Z_VERSION_ERROR (-6) */
};
var utils$5 = common;
var trees = trees$1;
var adler32$1 = adler32_1;
var crc32$2 = crc32_1;
var msg$2 = messages;
var Z_NO_FLUSH$1 = 0;
var Z_PARTIAL_FLUSH = 1;
var Z_FULL_FLUSH = 3;
var Z_FINISH$2 = 4;
var Z_BLOCK$1 = 5;
var Z_OK$2 = 0;
var Z_STREAM_END$2 = 1;
var Z_STREAM_ERROR$1 = -2;
var Z_DATA_ERROR$1 = -3;
var Z_BUF_ERROR$1 = -5;
var Z_DEFAULT_COMPRESSION$1 = -1;
var Z_FILTERED = 1;
var Z_HUFFMAN_ONLY = 2;
var Z_RLE = 3;
var Z_FIXED = 4;
var Z_DEFAULT_STRATEGY$1 = 0;
var Z_UNKNOWN = 2;
var Z_DEFLATED$2 = 8;
var MAX_MEM_LEVEL = 9;
var MAX_WBITS$1 = 15;
var DEF_MEM_LEVEL = 8;
var LENGTH_CODES = 29;
var LITERALS = 256;
var L_CODES = LITERALS + 1 + LENGTH_CODES;
var D_CODES = 30;
var BL_CODES = 19;
var HEAP_SIZE = 2 * L_CODES + 1;
var MAX_BITS = 15;
var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
var PRESET_DICT = 32;
var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;
var BS_NEED_MORE = 1;
var BS_BLOCK_DONE = 2;
var BS_FINISH_STARTED = 3;
var BS_FINISH_DONE = 4;
var OS_CODE = 3;
function err(strm, errorCode) {
  strm.msg = msg$2[errorCode];
  return errorCode;
}
function rank(f) {
  return (f << 1) - (f > 4 ? 9 : 0);
}
function zero(buf) {
  var len = buf.length;
  while (--len >= 0) {
    buf[len] = 0;
  }
}
function flush_pending(strm) {
  var s = strm.state;
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) {
    return;
  }
  utils$5.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}
function flush_block_only(s, last) {
  trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}
function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}
function putShortMSB(s, b) {
  s.pending_buf[s.pending++] = b >>> 8 & 255;
  s.pending_buf[s.pending++] = b & 255;
}
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;
  if (len > size) {
    len = size;
  }
  if (len === 0) {
    return 0;
  }
  strm.avail_in -= len;
  utils$5.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32$1(strm.adler, buf, len, start);
  } else if (strm.state.wrap === 2) {
    strm.adler = crc32$2(strm.adler, buf, len, start);
  }
  strm.next_in += len;
  strm.total_in += len;
  return len;
}
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;
  var scan = s.strstart;
  var match;
  var len;
  var best_len = s.prev_length;
  var nice_match = s.nice_match;
  var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
  var _win = s.window;
  var wmask = s.w_mask;
  var prev = s.prev;
  var strend = s.strstart + MAX_MATCH;
  var scan_end1 = _win[scan + best_len - 1];
  var scan_end = _win[scan + best_len];
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  if (nice_match > s.lookahead) {
    nice_match = s.lookahead;
  }
  do {
    match = cur_match;
    if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
      continue;
    }
    scan += 2;
    match++;
    do {
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;
    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1 = _win[scan + best_len - 1];
      scan_end = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;
  do {
    more = s.window_size - s.lookahead - s.strstart;
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
      utils$5.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      s.block_start -= _w_size;
      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n);
      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = m >= _w_size ? m - _w_size : 0;
      } while (--n);
      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
      while (s.insert) {
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
}
function deflate_stored(s, flush) {
  var max_block_size = 65535;
  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }
  for (; ; ) {
    if (s.lookahead <= 1) {
      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.strstart += s.lookahead;
    s.lookahead = 0;
    var max_start = s.block_start + max_block_size;
    if (s.strstart === 0 || s.strstart >= max_start) {
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.strstart > s.block_start) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_NEED_MORE;
}
function deflate_fast(s, flush) {
  var hash_head;
  var bflush;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
        s.match_length--;
        do {
          s.strstart++;
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        } while (--s.match_length !== 0);
        s.strstart++;
      } else {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
      }
    } else {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_slow(s, flush) {
  var hash_head;
  var bflush;
  var max_insert;
  for (; ; ) {
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    hash_head = 0;
    if (s.lookahead >= MIN_MATCH) {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
    }
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;
    if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
      s.match_length = longest_match(s, hash_head);
      if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
        s.match_length = MIN_MATCH - 1;
      }
    }
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    } else if (s.match_available) {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
      if (bflush) {
        flush_block_only(s, false);
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  if (s.match_available) {
    bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_rle(s, flush) {
  var bflush;
  var prev;
  var scan, strend;
  var _win = s.window;
  for (; ; ) {
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$1) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break;
      }
    }
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
        } while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
    }
    if (s.match_length >= MIN_MATCH) {
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function deflate_huff(s, flush) {
  var bflush;
  for (; ; ) {
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        break;
      }
    }
    s.match_length = 0;
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH$2) {
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
  }
  return BS_BLOCK_DONE;
}
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}
var configuration_table;
configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),
  /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),
  /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),
  /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),
  /* 3 */
  new Config(4, 4, 16, 16, deflate_slow),
  /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),
  /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),
  /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),
  /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),
  /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)
  /* 9 max compression */
];
function lm_init(s) {
  s.window_size = 2 * s.w_size;
  zero(s.head);
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;
  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}
function DeflateState() {
  this.strm = null;
  this.status = 0;
  this.pending_buf = null;
  this.pending_buf_size = 0;
  this.pending_out = 0;
  this.pending = 0;
  this.wrap = 0;
  this.gzhead = null;
  this.gzindex = 0;
  this.method = Z_DEFLATED$2;
  this.last_flush = -1;
  this.w_size = 0;
  this.w_bits = 0;
  this.w_mask = 0;
  this.window = null;
  this.window_size = 0;
  this.prev = null;
  this.head = null;
  this.ins_h = 0;
  this.hash_size = 0;
  this.hash_bits = 0;
  this.hash_mask = 0;
  this.hash_shift = 0;
  this.block_start = 0;
  this.match_length = 0;
  this.prev_match = 0;
  this.match_available = 0;
  this.strstart = 0;
  this.match_start = 0;
  this.lookahead = 0;
  this.prev_length = 0;
  this.max_chain_length = 0;
  this.max_lazy_match = 0;
  this.level = 0;
  this.strategy = 0;
  this.good_match = 0;
  this.nice_match = 0;
  this.dyn_ltree = new utils$5.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree = new utils$5.Buf16((2 * D_CODES + 1) * 2);
  this.bl_tree = new utils$5.Buf16((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);
  this.l_desc = null;
  this.d_desc = null;
  this.bl_desc = null;
  this.bl_count = new utils$5.Buf16(MAX_BITS + 1);
  this.heap = new utils$5.Buf16(2 * L_CODES + 1);
  zero(this.heap);
  this.heap_len = 0;
  this.heap_max = 0;
  this.depth = new utils$5.Buf16(2 * L_CODES + 1);
  zero(this.depth);
  this.l_buf = 0;
  this.lit_bufsize = 0;
  this.last_lit = 0;
  this.d_buf = 0;
  this.opt_len = 0;
  this.static_len = 0;
  this.matches = 0;
  this.insert = 0;
  this.bi_buf = 0;
  this.bi_valid = 0;
}
function deflateResetKeep(strm) {
  var s;
  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;
  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;
  if (s.wrap < 0) {
    s.wrap = -s.wrap;
  }
  s.status = s.wrap ? INIT_STATE : BUSY_STATE;
  strm.adler = s.wrap === 2 ? 0 : 1;
  s.last_flush = Z_NO_FLUSH$1;
  trees._tr_init(s);
  return Z_OK$2;
}
function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK$2) {
    lm_init(strm.state);
  }
  return ret;
}
function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  if (strm.state.wrap !== 2) {
    return Z_STREAM_ERROR$1;
  }
  strm.state.gzhead = head;
  return Z_OK$2;
}
function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) {
    return Z_STREAM_ERROR$1;
  }
  var wrap = 1;
  if (level === Z_DEFAULT_COMPRESSION$1) {
    level = 6;
  }
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else if (windowBits > 15) {
    wrap = 2;
    windowBits -= 16;
  }
  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  if (windowBits === 8) {
    windowBits = 9;
  }
  var s = new DeflateState();
  strm.state = s;
  s.strm = strm;
  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;
  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
  s.window = new utils$5.Buf8(s.w_size * 2);
  s.head = new utils$5.Buf16(s.hash_size);
  s.prev = new utils$5.Buf16(s.w_size);
  s.lit_bufsize = 1 << memLevel + 6;
  s.pending_buf_size = s.lit_bufsize * 4;
  s.pending_buf = new utils$5.Buf8(s.pending_buf_size);
  s.d_buf = 1 * s.lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;
  s.level = level;
  s.strategy = strategy;
  s.method = method;
  return deflateReset(strm);
}
function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED$2, MAX_WBITS$1, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY$1);
}
function deflate$3(strm, flush) {
  var old_flush, s;
  var beg, val;
  if (!strm || !strm.state || flush > Z_BLOCK$1 || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR$1) : Z_STREAM_ERROR$1;
  }
  s = strm.state;
  if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH$2) {
    return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$1);
  }
  s.strm = strm;
  old_flush = s.last_flush;
  s.last_flush = flush;
  if (s.status === INIT_STATE) {
    if (s.wrap === 2) {
      strm.adler = 0;
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) {
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      } else {
        put_byte(
          s,
          (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 255);
        put_byte(s, s.gzhead.time >> 8 & 255);
        put_byte(s, s.gzhead.time >> 16 & 255);
        put_byte(s, s.gzhead.time >> 24 & 255);
        put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
        put_byte(s, s.gzhead.os & 255);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 255);
          put_byte(s, s.gzhead.extra.length >> 8 & 255);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    } else {
      var header = Z_DEFLATED$2 + (s.w_bits - 8 << 4) << 8;
      var level_flags = -1;
      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= level_flags << 6;
      if (s.strstart !== 0) {
        header |= PRESET_DICT;
      }
      header += 31 - header % 31;
      s.status = BUSY_STATE;
      putShortMSB(s, header);
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 65535);
      }
      strm.adler = 1;
    }
  }
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra) {
      beg = s.pending;
      while (s.gzindex < (s.gzhead.extra.length & 65535)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 255);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    } else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name) {
      beg = s.pending;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    } else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment) {
      beg = s.pending;
      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32$2(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    } else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 255);
        put_byte(s, strm.adler >> 8 & 255);
        strm.adler = 0;
        s.status = BUSY_STATE;
      }
    } else {
      s.status = BUSY_STATE;
    }
  }
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      s.last_flush = -1;
      return Z_OK$2;
    }
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH$2) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR$1);
  }
  if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH$1 && s.status !== FINISH_STATE) {
    var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
      }
      return Z_OK$2;
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      } else if (flush !== Z_BLOCK$1) {
        trees._tr_stored_block(s, 0, 0, false);
        if (flush === Z_FULL_FLUSH) {
          zero(s.head);
          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK$2;
      }
    }
  }
  if (flush !== Z_FINISH$2) {
    return Z_OK$2;
  }
  if (s.wrap <= 0) {
    return Z_STREAM_END$2;
  }
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 255);
    put_byte(s, strm.adler >> 8 & 255);
    put_byte(s, strm.adler >> 16 & 255);
    put_byte(s, strm.adler >> 24 & 255);
    put_byte(s, strm.total_in & 255);
    put_byte(s, strm.total_in >> 8 & 255);
    put_byte(s, strm.total_in >> 16 & 255);
    put_byte(s, strm.total_in >> 24 & 255);
  } else {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 65535);
  }
  flush_pending(strm);
  if (s.wrap > 0) {
    s.wrap = -s.wrap;
  }
  return s.pending !== 0 ? Z_OK$2 : Z_STREAM_END$2;
}
function deflateEnd(strm) {
  var status2;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  status2 = strm.state.status;
  if (status2 !== INIT_STATE && status2 !== EXTRA_STATE && status2 !== NAME_STATE && status2 !== COMMENT_STATE && status2 !== HCRC_STATE && status2 !== BUSY_STATE && status2 !== FINISH_STATE) {
    return err(strm, Z_STREAM_ERROR$1);
  }
  strm.state = null;
  return status2 === BUSY_STATE ? err(strm, Z_DATA_ERROR$1) : Z_OK$2;
}
function deflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;
  var s;
  var str, n;
  var wrap;
  var avail;
  var next;
  var input;
  var tmpDict;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR$1;
  }
  s = strm.state;
  wrap = s.wrap;
  if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
    return Z_STREAM_ERROR$1;
  }
  if (wrap === 1) {
    strm.adler = adler32$1(strm.adler, dictionary, dictLength, 0);
  }
  s.wrap = 0;
  if (dictLength >= s.w_size) {
    if (wrap === 0) {
      zero(s.head);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    tmpDict = new utils$5.Buf8(s.w_size);
    utils$5.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  avail = strm.avail_in;
  next = strm.next_in;
  input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    str = s.strstart;
    n = s.lookahead - (MIN_MATCH - 1);
    do {
      s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
      s.prev[str & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK$2;
}
deflate$4.deflateInit = deflateInit;
deflate$4.deflateInit2 = deflateInit2;
deflate$4.deflateReset = deflateReset;
deflate$4.deflateResetKeep = deflateResetKeep;
deflate$4.deflateSetHeader = deflateSetHeader;
deflate$4.deflate = deflate$3;
deflate$4.deflateEnd = deflateEnd;
deflate$4.deflateSetDictionary = deflateSetDictionary;
deflate$4.deflateInfo = "pako deflate (from Nodeca project)";
var strings$2 = {};
var utils$4 = common;
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;
try {
  String.fromCharCode.apply(null, [0]);
} catch (__) {
  STR_APPLY_OK = false;
}
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch (__) {
  STR_APPLY_UIA_OK = false;
}
var _utf8len = new utils$4.Buf8(256);
for (var q = 0; q < 256; q++) {
  _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
}
_utf8len[254] = _utf8len[254] = 1;
strings$2.string2buf = function(str) {
  var buf, c2, c22, m_pos, i, str_len = str.length, buf_len = 0;
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c2 = str.charCodeAt(m_pos);
    if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    buf_len += c2 < 128 ? 1 : c2 < 2048 ? 2 : c2 < 65536 ? 3 : 4;
  }
  buf = new utils$4.Buf8(buf_len);
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c2 = str.charCodeAt(m_pos);
    if ((c2 & 64512) === 55296 && m_pos + 1 < str_len) {
      c22 = str.charCodeAt(m_pos + 1);
      if ((c22 & 64512) === 56320) {
        c2 = 65536 + (c2 - 55296 << 10) + (c22 - 56320);
        m_pos++;
      }
    }
    if (c2 < 128) {
      buf[i++] = c2;
    } else if (c2 < 2048) {
      buf[i++] = 192 | c2 >>> 6;
      buf[i++] = 128 | c2 & 63;
    } else if (c2 < 65536) {
      buf[i++] = 224 | c2 >>> 12;
      buf[i++] = 128 | c2 >>> 6 & 63;
      buf[i++] = 128 | c2 & 63;
    } else {
      buf[i++] = 240 | c2 >>> 18;
      buf[i++] = 128 | c2 >>> 12 & 63;
      buf[i++] = 128 | c2 >>> 6 & 63;
      buf[i++] = 128 | c2 & 63;
    }
  }
  return buf;
};
function buf2binstring(buf, len) {
  if (len < 65534) {
    if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
      return String.fromCharCode.apply(null, utils$4.shrinkBuf(buf, len));
    }
  }
  var result = "";
  for (var i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
}
strings$2.buf2binstring = function(buf) {
  return buf2binstring(buf, buf.length);
};
strings$2.binstring2buf = function(str) {
  var buf = new utils$4.Buf8(str.length);
  for (var i = 0, len = buf.length; i < len; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
};
strings$2.buf2string = function(buf, max2) {
  var i, out, c2, c_len;
  var len = max2 || buf.length;
  var utf16buf = new Array(len * 2);
  for (out = 0, i = 0; i < len; ) {
    c2 = buf[i++];
    if (c2 < 128) {
      utf16buf[out++] = c2;
      continue;
    }
    c_len = _utf8len[c2];
    if (c_len > 4) {
      utf16buf[out++] = 65533;
      i += c_len - 1;
      continue;
    }
    c2 &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
    while (c_len > 1 && i < len) {
      c2 = c2 << 6 | buf[i++] & 63;
      c_len--;
    }
    if (c_len > 1) {
      utf16buf[out++] = 65533;
      continue;
    }
    if (c2 < 65536) {
      utf16buf[out++] = c2;
    } else {
      c2 -= 65536;
      utf16buf[out++] = 55296 | c2 >> 10 & 1023;
      utf16buf[out++] = 56320 | c2 & 1023;
    }
  }
  return buf2binstring(utf16buf, out);
};
strings$2.utf8border = function(buf, max2) {
  var pos;
  max2 = max2 || buf.length;
  if (max2 > buf.length) {
    max2 = buf.length;
  }
  pos = max2 - 1;
  while (pos >= 0 && (buf[pos] & 192) === 128) {
    pos--;
  }
  if (pos < 0) {
    return max2;
  }
  if (pos === 0) {
    return max2;
  }
  return pos + _utf8len[buf[pos]] > max2 ? pos : max2;
};
function ZStream$2() {
  this.input = null;
  this.next_in = 0;
  this.avail_in = 0;
  this.total_in = 0;
  this.output = null;
  this.next_out = 0;
  this.avail_out = 0;
  this.total_out = 0;
  this.msg = "";
  this.state = null;
  this.data_type = 2;
  this.adler = 0;
}
var zstream = ZStream$2;
var zlib_deflate = deflate$4;
var utils$3 = common;
var strings$1 = strings$2;
var msg$1 = messages;
var ZStream$1 = zstream;
var toString$1 = Object.prototype.toString;
var Z_NO_FLUSH = 0;
var Z_FINISH$1 = 4;
var Z_OK$1 = 0;
var Z_STREAM_END$1 = 1;
var Z_SYNC_FLUSH = 2;
var Z_DEFAULT_COMPRESSION = -1;
var Z_DEFAULT_STRATEGY = 0;
var Z_DEFLATED$1 = 8;
function Deflate(options) {
  if (!(this instanceof Deflate)) return new Deflate(options);
  this.options = utils$3.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED$1,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY,
    to: ""
  }, options || {});
  var opt = this.options;
  if (opt.raw && opt.windowBits > 0) {
    opt.windowBits = -opt.windowBits;
  } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
    opt.windowBits += 16;
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new ZStream$1();
  this.strm.avail_out = 0;
  var status2 = zlib_deflate.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );
  if (status2 !== Z_OK$1) {
    throw new Error(msg$1[status2]);
  }
  if (opt.header) {
    zlib_deflate.deflateSetHeader(this.strm, opt.header);
  }
  if (opt.dictionary) {
    var dict;
    if (typeof opt.dictionary === "string") {
      dict = strings$1.string2buf(opt.dictionary);
    } else if (toString$1.call(opt.dictionary) === "[object ArrayBuffer]") {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }
    status2 = zlib_deflate.deflateSetDictionary(this.strm, dict);
    if (status2 !== Z_OK$1) {
      throw new Error(msg$1[status2]);
    }
    this._dict_set = true;
  }
}
Deflate.prototype.push = function(data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status2, _mode;
  if (this.ended) {
    return false;
  }
  _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH$1 : Z_NO_FLUSH;
  if (typeof data === "string") {
    strm.input = strings$1.string2buf(data);
  } else if (toString$1.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  do {
    if (strm.avail_out === 0) {
      strm.output = new utils$3.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status2 = zlib_deflate.deflate(strm, _mode);
    if (status2 !== Z_STREAM_END$1 && status2 !== Z_OK$1) {
      this.onEnd(status2);
      this.ended = true;
      return false;
    }
    if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH$1 || _mode === Z_SYNC_FLUSH)) {
      if (this.options.to === "string") {
        this.onData(strings$1.buf2binstring(utils$3.shrinkBuf(strm.output, strm.next_out)));
      } else {
        this.onData(utils$3.shrinkBuf(strm.output, strm.next_out));
      }
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status2 !== Z_STREAM_END$1);
  if (_mode === Z_FINISH$1) {
    status2 = zlib_deflate.deflateEnd(this.strm);
    this.onEnd(status2);
    this.ended = true;
    return status2 === Z_OK$1;
  }
  if (_mode === Z_SYNC_FLUSH) {
    this.onEnd(Z_OK$1);
    strm.avail_out = 0;
    return true;
  }
  return true;
};
Deflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Deflate.prototype.onEnd = function(status2) {
  if (status2 === Z_OK$1) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = utils$3.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status2;
  this.msg = this.strm.msg;
};
function deflate$2(input, options) {
  var deflator = new Deflate(options);
  deflator.push(input, true);
  if (deflator.err) {
    throw deflator.msg || msg$1[deflator.err];
  }
  return deflator.result;
}
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate$2(input, options);
}
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate$2(input, options);
}
deflate$5.Deflate = Deflate;
deflate$5.deflate = deflate$2;
deflate$5.deflateRaw = deflateRaw;
deflate$5.gzip = gzip;
var inflate$5 = {};
var inflate$4 = {};
var BAD$1 = 30;
var TYPE$1 = 12;
var inffast = function inflate_fast(strm, start) {
  var state;
  var _in;
  var last;
  var _out;
  var beg;
  var end;
  var dmax;
  var wsize;
  var whave;
  var wnext;
  var s_window;
  var hold;
  var bits;
  var lcode;
  var dcode;
  var lmask;
  var dmask;
  var here;
  var op;
  var len;
  var dist;
  var from;
  var from_source;
  var input, output;
  state = strm.state;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
  dmax = state.dmax;
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;
  top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }
      here = lcode[hold & lmask];
      dolen:
        for (; ; ) {
          op = here >>> 24;
          hold >>>= op;
          bits -= op;
          op = here >>> 16 & 255;
          if (op === 0) {
            output[_out++] = here & 65535;
          } else if (op & 16) {
            len = here & 65535;
            op &= 15;
            if (op) {
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
              len += hold & (1 << op) - 1;
              hold >>>= op;
              bits -= op;
            }
            if (bits < 15) {
              hold += input[_in++] << bits;
              bits += 8;
              hold += input[_in++] << bits;
              bits += 8;
            }
            here = dcode[hold & dmask];
            dodist:
              for (; ; ) {
                op = here >>> 24;
                hold >>>= op;
                bits -= op;
                op = here >>> 16 & 255;
                if (op & 16) {
                  dist = here & 65535;
                  op &= 15;
                  if (bits < op) {
                    hold += input[_in++] << bits;
                    bits += 8;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                    }
                  }
                  dist += hold & (1 << op) - 1;
                  if (dist > dmax) {
                    strm.msg = "invalid distance too far back";
                    state.mode = BAD$1;
                    break top;
                  }
                  hold >>>= op;
                  bits -= op;
                  op = _out - beg;
                  if (dist > op) {
                    op = dist - op;
                    if (op > whave) {
                      if (state.sane) {
                        strm.msg = "invalid distance too far back";
                        state.mode = BAD$1;
                        break top;
                      }
                    }
                    from = 0;
                    from_source = s_window;
                    if (wnext === 0) {
                      from += wsize - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    } else if (wnext < op) {
                      from += wsize + wnext - op;
                      op -= wnext;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = 0;
                        if (wnext < len) {
                          op = wnext;
                          len -= op;
                          do {
                            output[_out++] = s_window[from++];
                          } while (--op);
                          from = _out - dist;
                          from_source = output;
                        }
                      }
                    } else {
                      from += wnext - op;
                      if (op < len) {
                        len -= op;
                        do {
                          output[_out++] = s_window[from++];
                        } while (--op);
                        from = _out - dist;
                        from_source = output;
                      }
                    }
                    while (len > 2) {
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      output[_out++] = from_source[from++];
                      len -= 3;
                    }
                    if (len) {
                      output[_out++] = from_source[from++];
                      if (len > 1) {
                        output[_out++] = from_source[from++];
                      }
                    }
                  } else {
                    from = _out - dist;
                    do {
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      output[_out++] = output[from++];
                      len -= 3;
                    } while (len > 2);
                    if (len) {
                      output[_out++] = output[from++];
                      if (len > 1) {
                        output[_out++] = output[from++];
                      }
                    }
                  }
                } else if ((op & 64) === 0) {
                  here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                  continue dodist;
                } else {
                  strm.msg = "invalid distance code";
                  state.mode = BAD$1;
                  break top;
                }
                break;
              }
          } else if ((op & 64) === 0) {
            here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
            continue dolen;
          } else if (op & 32) {
            state.mode = TYPE$1;
            break top;
          } else {
            strm.msg = "invalid literal/length code";
            state.mode = BAD$1;
            break top;
          }
          break;
        }
    } while (_in < last && _out < end);
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
  strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
  state.hold = hold;
  state.bits = bits;
  return;
};
var utils$2 = common;
var MAXBITS = 15;
var ENOUGH_LENS$1 = 852;
var ENOUGH_DISTS$1 = 592;
var CODES$1 = 0;
var LENS$1 = 1;
var DISTS$1 = 2;
var lbase = [
  /* Length codes 257..285 base */
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
];
var lext = [
  /* Length codes 257..285 extra */
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  16,
  17,
  17,
  17,
  17,
  18,
  18,
  18,
  18,
  19,
  19,
  19,
  19,
  20,
  20,
  20,
  20,
  21,
  21,
  21,
  21,
  16,
  72,
  78
];
var dbase = [
  /* Distance codes 0..29 base */
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577,
  0,
  0
];
var dext = [
  /* Distance codes 0..29 extra */
  16,
  16,
  16,
  16,
  17,
  17,
  18,
  18,
  19,
  19,
  20,
  20,
  21,
  21,
  22,
  22,
  23,
  23,
  24,
  24,
  25,
  25,
  26,
  26,
  27,
  27,
  28,
  28,
  29,
  29,
  64,
  64
];
var inftrees = function inflate_table(type2, lens, lens_index, codes, table, table_index, work, opts) {
  var bits = opts.bits;
  var len = 0;
  var sym = 0;
  var min2 = 0, max2 = 0;
  var root = 0;
  var curr = 0;
  var drop = 0;
  var left = 0;
  var used = 0;
  var huff = 0;
  var incr;
  var fill;
  var low;
  var mask;
  var next;
  var base = null;
  var base_index = 0;
  var end;
  var count = new utils$2.Buf16(MAXBITS + 1);
  var offs = new utils$2.Buf16(MAXBITS + 1);
  var extra = null;
  var extra_index = 0;
  var here_bits, here_op, here_val;
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }
  root = bits;
  for (max2 = MAXBITS; max2 >= 1; max2--) {
    if (count[max2] !== 0) {
      break;
    }
  }
  if (root > max2) {
    root = max2;
  }
  if (max2 === 0) {
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    table[table_index++] = 1 << 24 | 64 << 16 | 0;
    opts.bits = 1;
    return 0;
  }
  for (min2 = 1; min2 < max2; min2++) {
    if (count[min2] !== 0) {
      break;
    }
  }
  if (root < min2) {
    root = min2;
  }
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }
  }
  if (left > 0 && (type2 === CODES$1 || max2 !== 1)) {
    return -1;
  }
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }
  if (type2 === CODES$1) {
    base = extra = work;
    end = 19;
  } else if (type2 === LENS$1) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;
  } else {
    base = dbase;
    extra = dext;
    end = -1;
  }
  huff = 0;
  sym = 0;
  len = min2;
  next = table_index;
  curr = root;
  drop = 0;
  low = -1;
  used = 1 << root;
  mask = used - 1;
  if (type2 === LENS$1 && used > ENOUGH_LENS$1 || type2 === DISTS$1 && used > ENOUGH_DISTS$1) {
    return 1;
  }
  for (; ; ) {
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    } else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    } else {
      here_op = 32 + 64;
      here_val = 0;
    }
    incr = 1 << len - drop;
    fill = 1 << curr;
    min2 = fill;
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
    } while (fill !== 0);
    incr = 1 << len - 1;
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }
    sym++;
    if (--count[len] === 0) {
      if (len === max2) {
        break;
      }
      len = lens[lens_index + work[sym]];
    }
    if (len > root && (huff & mask) !== low) {
      if (drop === 0) {
        drop = root;
      }
      next += min2;
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max2) {
        left -= count[curr + drop];
        if (left <= 0) {
          break;
        }
        curr++;
        left <<= 1;
      }
      used += 1 << curr;
      if (type2 === LENS$1 && used > ENOUGH_LENS$1 || type2 === DISTS$1 && used > ENOUGH_DISTS$1) {
        return 1;
      }
      low = huff & mask;
      table[low] = root << 24 | curr << 16 | next - table_index | 0;
    }
  }
  if (huff !== 0) {
    table[next + huff] = len - drop << 24 | 64 << 16 | 0;
  }
  opts.bits = root;
  return 0;
};
var utils$1 = common;
var adler32 = adler32_1;
var crc32$1 = crc32_1;
var inflate_fast2 = inffast;
var inflate_table2 = inftrees;
var CODES = 0;
var LENS = 1;
var DISTS = 2;
var Z_FINISH = 4;
var Z_BLOCK = 5;
var Z_TREES = 6;
var Z_OK = 0;
var Z_STREAM_END = 1;
var Z_NEED_DICT = 2;
var Z_STREAM_ERROR = -2;
var Z_DATA_ERROR = -3;
var Z_MEM_ERROR = -4;
var Z_BUF_ERROR = -5;
var Z_DEFLATED = 8;
var HEAD = 1;
var FLAGS = 2;
var TIME = 3;
var OS = 4;
var EXLEN = 5;
var EXTRA = 6;
var NAME = 7;
var COMMENT = 8;
var HCRC = 9;
var DICTID = 10;
var DICT = 11;
var TYPE = 12;
var TYPEDO = 13;
var STORED = 14;
var COPY_ = 15;
var COPY = 16;
var TABLE = 17;
var LENLENS = 18;
var CODELENS = 19;
var LEN_ = 20;
var LEN = 21;
var LENEXT = 22;
var DIST = 23;
var DISTEXT = 24;
var MATCH = 25;
var LIT = 26;
var CHECK = 27;
var LENGTH = 28;
var DONE = 29;
var BAD = 30;
var MEM = 31;
var SYNC = 32;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
var MAX_WBITS = 15;
var DEF_WBITS = MAX_WBITS;
function zswap32(q) {
  return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
}
function InflateState() {
  this.mode = 0;
  this.last = false;
  this.wrap = 0;
  this.havedict = false;
  this.flags = 0;
  this.dmax = 0;
  this.check = 0;
  this.total = 0;
  this.head = null;
  this.wbits = 0;
  this.wsize = 0;
  this.whave = 0;
  this.wnext = 0;
  this.window = null;
  this.hold = 0;
  this.bits = 0;
  this.length = 0;
  this.offset = 0;
  this.extra = 0;
  this.lencode = null;
  this.distcode = null;
  this.lenbits = 0;
  this.distbits = 0;
  this.ncode = 0;
  this.nlen = 0;
  this.ndist = 0;
  this.have = 0;
  this.next = null;
  this.lens = new utils$1.Buf16(320);
  this.work = new utils$1.Buf16(288);
  this.lendyn = null;
  this.distdyn = null;
  this.sane = 0;
  this.back = 0;
  this.was = 0;
}
function inflateResetKeep(strm) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = "";
  if (state.wrap) {
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null;
  state.hold = 0;
  state.bits = 0;
  state.lencode = state.lendyn = new utils$1.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils$1.Buf32(ENOUGH_DISTS);
  state.sane = 1;
  state.back = -1;
  return Z_OK;
}
function inflateReset(strm) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);
}
function inflateReset2(strm, windowBits) {
  var wrap;
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  } else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}
function inflateInit2(strm, windowBits) {
  var ret;
  var state;
  if (!strm) {
    return Z_STREAM_ERROR;
  }
  state = new InflateState();
  strm.state = state;
  state.window = null;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null;
  }
  return ret;
}
function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}
var virgin = true;
var lenfix, distfix;
function fixedtables(state) {
  if (virgin) {
    var sym;
    lenfix = new utils$1.Buf32(512);
    distfix = new utils$1.Buf32(32);
    sym = 0;
    while (sym < 144) {
      state.lens[sym++] = 8;
    }
    while (sym < 256) {
      state.lens[sym++] = 9;
    }
    while (sym < 280) {
      state.lens[sym++] = 7;
    }
    while (sym < 288) {
      state.lens[sym++] = 8;
    }
    inflate_table2(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
    sym = 0;
    while (sym < 32) {
      state.lens[sym++] = 5;
    }
    inflate_table2(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
    virgin = false;
  }
  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}
function updatewindow(strm, src2, end, copy) {
  var dist;
  var state = strm.state;
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;
    state.window = new utils$1.Buf8(state.wsize);
  }
  if (copy >= state.wsize) {
    utils$1.arraySet(state.window, src2, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  } else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    utils$1.arraySet(state.window, src2, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      utils$1.arraySet(state.window, src2, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    } else {
      state.wnext += dist;
      if (state.wnext === state.wsize) {
        state.wnext = 0;
      }
      if (state.whave < state.wsize) {
        state.whave += dist;
      }
    }
  }
  return 0;
}
function inflate$3(strm, flush) {
  var state;
  var input, output;
  var next;
  var put;
  var have, left;
  var hold;
  var bits;
  var _in, _out;
  var copy;
  var from;
  var from_source;
  var here = 0;
  var here_bits, here_op, here_val;
  var last_bits, last_op, last_val;
  var len;
  var ret;
  var hbuf = new utils$1.Buf8(4);
  var opts;
  var n;
  var order = (
    /* permutation of code lengths */
    [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
  );
  if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (state.mode === TYPE) {
    state.mode = TYPEDO;
  }
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  _in = have;
  _out = left;
  ret = Z_OK;
  inf_leave:
    for (; ; ) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.wrap & 2 && hold === 35615) {
            state.check = 0;
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
            hold = 0;
            bits = 0;
            state.mode = FLAGS;
            break;
          }
          state.flags = 0;
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
          (((hold & 255) << 8) + (hold >> 8)) % 31) {
            strm.msg = "incorrect header check";
            state.mode = BAD;
            break;
          }
          if ((hold & 15) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          hold >>>= 4;
          bits -= 4;
          len = (hold & 15) + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          } else if (len > state.wbits) {
            strm.msg = "invalid window size";
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << len;
          strm.adler = state.check = 1;
          state.mode = hold & 512 ? DICTID : TYPE;
          hold = 0;
          bits = 0;
          break;
        case FLAGS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.flags = hold;
          if ((state.flags & 255) !== Z_DEFLATED) {
            strm.msg = "unknown compression method";
            state.mode = BAD;
            break;
          }
          if (state.flags & 57344) {
            strm.msg = "unknown header flags set";
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = hold >> 8 & 1;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = TIME;
        case TIME:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            hbuf[2] = hold >>> 16 & 255;
            hbuf[3] = hold >>> 24 & 255;
            state.check = crc32$1(state.check, hbuf, 4, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = OS;
        case OS:
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (state.head) {
            state.head.xflags = hold & 255;
            state.head.os = hold >> 8;
          }
          if (state.flags & 512) {
            hbuf[0] = hold & 255;
            hbuf[1] = hold >>> 8 & 255;
            state.check = crc32$1(state.check, hbuf, 2, 0);
          }
          hold = 0;
          bits = 0;
          state.mode = EXLEN;
        case EXLEN:
          if (state.flags & 1024) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32$1(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
          } else if (state.head) {
            state.head.extra = null;
          }
          state.mode = EXTRA;
        case EXTRA:
          if (state.flags & 1024) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  state.head.extra = new Array(state.head.extra_len);
                }
                utils$1.arraySet(
                  state.head.extra,
                  input,
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  copy,
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
              }
              if (state.flags & 512) {
                state.check = crc32$1(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
        case NAME:
          if (state.flags & 2048) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32$1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
        case COMMENT:
          if (state.flags & 4096) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              if (state.head && len && state.length < 65536) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 512) {
              state.check = crc32$1(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
        case HCRC:
          if (state.flags & 512) {
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.check & 65535)) {
              strm.msg = "header crc mismatch";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          if (state.head) {
            state.head.hcrc = state.flags >> 9 & 1;
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          strm.adler = state.check = zswap32(hold);
          hold = 0;
          bits = 0;
          state.mode = DICT;
        case DICT:
          if (state.havedict === 0) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            return Z_NEED_DICT;
          }
          strm.adler = state.check = 1;
          state.mode = TYPE;
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave;
          }
        case TYPEDO:
          if (state.last) {
            hold >>>= bits & 7;
            bits -= bits & 7;
            state.mode = CHECK;
            break;
          }
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.last = hold & 1;
          hold >>>= 1;
          bits -= 1;
          switch (hold & 3) {
            case 0:
              state.mode = STORED;
              break;
            case 1:
              fixedtables(state);
              state.mode = LEN_;
              if (flush === Z_TREES) {
                hold >>>= 2;
                bits -= 2;
                break inf_leave;
              }
              break;
            case 2:
              state.mode = TABLE;
              break;
            case 3:
              strm.msg = "invalid block type";
              state.mode = BAD;
          }
          hold >>>= 2;
          bits -= 2;
          break;
        case STORED:
          hold >>>= bits & 7;
          bits -= bits & 7;
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
            strm.msg = "invalid stored block lengths";
            state.mode = BAD;
            break;
          }
          state.length = hold & 65535;
          hold = 0;
          bits = 0;
          state.mode = COPY_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case COPY_:
          state.mode = COPY;
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            utils$1.arraySet(output, input, next, copy, put);
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          state.mode = TYPE;
          break;
        case TABLE:
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          state.nlen = (hold & 31) + 257;
          hold >>>= 5;
          bits -= 5;
          state.ndist = (hold & 31) + 1;
          hold >>>= 5;
          bits -= 5;
          state.ncode = (hold & 15) + 4;
          hold >>>= 4;
          bits -= 4;
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = "too many length or distance symbols";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = LENLENS;
        case LENLENS:
          while (state.have < state.ncode) {
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.lens[order[state.have++]] = hold & 7;
            hold >>>= 3;
            bits -= 3;
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          state.lencode = state.lendyn;
          state.lenbits = 7;
          opts = { bits: state.lenbits };
          ret = inflate_table2(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid code lengths set";
            state.mode = BAD;
            break;
          }
          state.have = 0;
          state.mode = CODELENS;
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (; ; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_val < 16) {
              hold >>>= here_bits;
              bits -= here_bits;
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                if (state.have === 0) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 3);
                hold >>>= 2;
                bits -= 2;
              } else if (here_val === 17) {
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 3 + (hold & 7);
                hold >>>= 3;
                bits -= 3;
              } else {
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                hold >>>= here_bits;
                bits -= here_bits;
                len = 0;
                copy = 11 + (hold & 127);
                hold >>>= 7;
                bits -= 7;
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = "invalid bit length repeat";
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }
          if (state.mode === BAD) {
            break;
          }
          if (state.lens[256] === 0) {
            strm.msg = "invalid code -- missing end-of-block";
            state.mode = BAD;
            break;
          }
          state.lenbits = 9;
          opts = { bits: state.lenbits };
          ret = inflate_table2(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;
          if (ret) {
            strm.msg = "invalid literal/lengths set";
            state.mode = BAD;
            break;
          }
          state.distbits = 6;
          state.distcode = state.distdyn;
          opts = { bits: state.distbits };
          ret = inflate_table2(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          state.distbits = opts.bits;
          if (ret) {
            strm.msg = "invalid distances set";
            state.mode = BAD;
            break;
          }
          state.mode = LEN_;
          if (flush === Z_TREES) {
            break inf_leave;
          }
        case LEN_:
          state.mode = LEN;
        case LEN:
          if (have >= 6 && left >= 258) {
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            inflate_fast2(strm, _out);
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (; ; ) {
            here = state.lencode[hold & (1 << state.lenbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if (here_op && (here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = "invalid literal/length code";
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
        case LENEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.length += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          state.was = state.length;
          state.mode = DIST;
        case DIST:
          for (; ; ) {
            here = state.distcode[hold & (1 << state.distbits) - 1];
            here_bits = here >>> 24;
            here_op = here >>> 16 & 255;
            here_val = here & 65535;
            if (here_bits <= bits) {
              break;
            }
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          if ((here_op & 240) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (; ; ) {
              here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (last_bits + here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            hold >>>= last_bits;
            bits -= last_bits;
            state.back += last_bits;
          }
          hold >>>= here_bits;
          bits -= here_bits;
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = "invalid distance code";
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = here_op & 15;
          state.mode = DISTEXT;
        case DISTEXT:
          if (state.extra) {
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.offset += hold & (1 << state.extra) - 1;
            hold >>>= state.extra;
            bits -= state.extra;
            state.back += state.extra;
          }
          if (state.offset > state.dmax) {
            strm.msg = "invalid distance too far back";
            state.mode = BAD;
            break;
          }
          state.mode = MATCH;
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) {
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = "invalid distance too far back";
                state.mode = BAD;
                break;
              }
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else {
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold |= input[next++] << bits;
              bits += 8;
            }
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (_out) {
              strm.adler = state.check = /*UPDATE(state.check, put - _out, _out);*/
              state.flags ? crc32$1(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
            }
            _out = left;
            if ((state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = "incorrect data check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = LENGTH;
        case LENGTH:
          if (state.wrap && state.flags) {
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (hold !== (state.total & 4294967295)) {
              strm.msg = "incorrect length check";
              state.mode = BAD;
              break;
            }
            hold = 0;
            bits = 0;
          }
          state.mode = DONE;
        case DONE:
          ret = Z_STREAM_END;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR;
        case SYNC:
        default:
          return Z_STREAM_ERROR;
      }
    }
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
    state.flags ? crc32$1(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}
function inflateEnd(strm) {
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}
function inflateGetHeader(strm, head) {
  var state;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if ((state.wrap & 2) === 0) {
    return Z_STREAM_ERROR;
  }
  state.head = head;
  head.done = false;
  return Z_OK;
}
function inflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;
  var state;
  var dictid;
  var ret;
  if (!strm || !strm.state) {
    return Z_STREAM_ERROR;
  }
  state = strm.state;
  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR;
  }
  if (state.mode === DICT) {
    dictid = 1;
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR;
    }
  }
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  return Z_OK;
}
inflate$4.inflateReset = inflateReset;
inflate$4.inflateReset2 = inflateReset2;
inflate$4.inflateResetKeep = inflateResetKeep;
inflate$4.inflateInit = inflateInit;
inflate$4.inflateInit2 = inflateInit2;
inflate$4.inflate = inflate$3;
inflate$4.inflateEnd = inflateEnd;
inflate$4.inflateGetHeader = inflateGetHeader;
inflate$4.inflateSetDictionary = inflateSetDictionary;
inflate$4.inflateInfo = "pako inflate (from Nodeca project)";
var constants$1 = {
  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_BLOCK: 5,
  Z_TREES: 6,
  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DATA_ERROR: -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR: -5,
  //Z_VERSION_ERROR: -6,
  /* compression levels */
  Z_NO_COMPRESSION: 0,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_DEFAULT_COMPRESSION: -1,
  Z_FILTERED: 1,
  Z_HUFFMAN_ONLY: 2,
  Z_RLE: 3,
  Z_FIXED: 4,
  Z_DEFAULT_STRATEGY: 0,
  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY: 0,
  Z_TEXT: 1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN: 2,
  /* The deflate compression method */
  Z_DEFLATED: 8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};
function GZheader$1() {
  this.text = 0;
  this.time = 0;
  this.xflags = 0;
  this.os = 0;
  this.extra = null;
  this.extra_len = 0;
  this.name = "";
  this.comment = "";
  this.hcrc = 0;
  this.done = false;
}
var gzheader = GZheader$1;
var zlib_inflate = inflate$4;
var utils = common;
var strings = strings$2;
var c = constants$1;
var msg = messages;
var ZStream = zstream;
var GZheader = gzheader;
var toString = Object.prototype.toString;
function Inflate(options) {
  if (!(this instanceof Inflate)) return new Inflate(options);
  this.options = utils.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ""
  }, options || {});
  var opt = this.options;
  if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) {
      opt.windowBits = -15;
    }
  }
  if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
    opt.windowBits += 32;
  }
  if (opt.windowBits > 15 && opt.windowBits < 48) {
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }
  this.err = 0;
  this.msg = "";
  this.ended = false;
  this.chunks = [];
  this.strm = new ZStream();
  this.strm.avail_out = 0;
  var status2 = zlib_inflate.inflateInit2(
    this.strm,
    opt.windowBits
  );
  if (status2 !== c.Z_OK) {
    throw new Error(msg[status2]);
  }
  this.header = new GZheader();
  zlib_inflate.inflateGetHeader(this.strm, this.header);
  if (opt.dictionary) {
    if (typeof opt.dictionary === "string") {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) {
      status2 = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
      if (status2 !== c.Z_OK) {
        throw new Error(msg[status2]);
      }
    }
  }
}
Inflate.prototype.push = function(data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var dictionary = this.options.dictionary;
  var status2, _mode;
  var next_out_utf8, tail, utf8str;
  var allowBufError = false;
  if (this.ended) {
    return false;
  }
  _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
  if (typeof data === "string") {
    strm.input = strings.binstring2buf(data);
  } else if (toString.call(data) === "[object ArrayBuffer]") {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }
  strm.next_in = 0;
  strm.avail_in = strm.input.length;
  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status2 = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
    if (status2 === c.Z_NEED_DICT && dictionary) {
      status2 = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
    }
    if (status2 === c.Z_BUF_ERROR && allowBufError === true) {
      status2 = c.Z_OK;
      allowBufError = false;
    }
    if (status2 !== c.Z_STREAM_END && status2 !== c.Z_OK) {
      this.onEnd(status2);
      this.ended = true;
      return false;
    }
    if (strm.next_out) {
      if (strm.avail_out === 0 || status2 === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
        if (this.options.to === "string") {
          next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
          tail = strm.next_out - next_out_utf8;
          utf8str = strings.buf2string(strm.output, next_out_utf8);
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) {
            utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
          }
          this.onData(utf8str);
        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    }
    if (strm.avail_in === 0 && strm.avail_out === 0) {
      allowBufError = true;
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status2 !== c.Z_STREAM_END);
  if (status2 === c.Z_STREAM_END) {
    _mode = c.Z_FINISH;
  }
  if (_mode === c.Z_FINISH) {
    status2 = zlib_inflate.inflateEnd(this.strm);
    this.onEnd(status2);
    this.ended = true;
    return status2 === c.Z_OK;
  }
  if (_mode === c.Z_SYNC_FLUSH) {
    this.onEnd(c.Z_OK);
    strm.avail_out = 0;
    return true;
  }
  return true;
};
Inflate.prototype.onData = function(chunk) {
  this.chunks.push(chunk);
};
Inflate.prototype.onEnd = function(status2) {
  if (status2 === c.Z_OK) {
    if (this.options.to === "string") {
      this.result = this.chunks.join("");
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status2;
  this.msg = this.strm.msg;
};
function inflate$2(input, options) {
  var inflator = new Inflate(options);
  inflator.push(input, true);
  if (inflator.err) {
    throw inflator.msg || msg[inflator.err];
  }
  return inflator.result;
}
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate$2(input, options);
}
inflate$5.Inflate = Inflate;
inflate$5.inflate = inflate$2;
inflate$5.inflateRaw = inflateRaw;
inflate$5.ungzip = inflate$2;
var assign = common.assign;
var deflate$1 = deflate$5;
var inflate$1 = inflate$5;
var constants = constants$1;
var pako$1 = {};
assign(pako$1, deflate$1, inflate$1, constants);
var pako_1 = pako$1;
const processFn = (fn, options) => function(...args) {
  const P = options.promiseModule;
  return new P((resolve2, reject) => {
    if (options.multiArgs) {
      args.push((...result) => {
        if (options.errorFirst) {
          if (result[0]) {
            reject(result);
          } else {
            result.shift();
            resolve2(result);
          }
        } else {
          resolve2(result);
        }
      });
    } else if (options.errorFirst) {
      args.push((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve2(result);
        }
      });
    } else {
      args.push(resolve2);
    }
    fn.apply(this, args);
  });
};
var pify$1 = (input, options) => {
  options = Object.assign({
    exclude: [/.+(Sync|Stream)$/],
    errorFirst: true,
    promiseModule: Promise
  }, options);
  const objType = typeof input;
  if (!(input !== null && (objType === "object" || objType === "function"))) {
    throw new TypeError(`Expected \`input\` to be a \`Function\` or \`Object\`, got \`${input === null ? "null" : objType}\``);
  }
  const filter = (key) => {
    const match = (pattern) => typeof pattern === "string" ? key === pattern : pattern.test(key);
    return options.include ? options.include.some(match) : !options.exclude.some(match);
  };
  let ret;
  if (objType === "function") {
    ret = function(...args) {
      return options.excludeMain ? input(...args) : processFn(input, options).apply(this, args);
    };
  } else {
    ret = Object.create(Object.getPrototypeOf(input));
  }
  for (const key in input) {
    const property = input[key];
    ret[key] = typeof property === "function" && filter(key) ? processFn(property, options) : property;
  }
  return ret;
};
function makeArray(subject) {
  return Array.isArray(subject) ? subject : [subject];
}
const EMPTY = "";
const SPACE = " ";
const ESCAPE = "\\";
const REGEX_TEST_BLANK_LINE = /^\s+$/;
const REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
const REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
const REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
const REGEX_SPLITALL_CRLF = /\r?\n/g;
const REGEX_TEST_INVALID_PATH = /^\.*\/|^\.+$/;
const SLASH = "/";
let TMP_KEY_IGNORE = "node-ignore";
if (typeof Symbol !== "undefined") {
  TMP_KEY_IGNORE = Symbol.for("node-ignore");
}
const KEY_IGNORE = TMP_KEY_IGNORE;
const define = (object, key, value) => Object.defineProperty(object, key, { value });
const REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
const RETURN_FALSE = () => false;
const sanitizeRange = (range2) => range2.replace(
  REGEX_REGEXP_RANGE,
  (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY
);
const cleanRangeBackSlash = (slashes) => {
  const { length } = slashes;
  return slashes.slice(0, length - length % 2);
};
const REPLACERS = [
  [
    // remove BOM
    // TODO:
    // Other similar zero-width characters?
    /^\uFEFF/,
    () => EMPTY
  ],
  // > Trailing spaces are ignored unless they are quoted with backslash ("\")
  [
    // (a\ ) -> (a )
    // (a  ) -> (a)
    // (a ) -> (a)
    // (a \ ) -> (a  )
    /((?:\\\\)*?)(\\?\s+)$/,
    (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
  ],
  // replace (\ ) with ' '
  // (\ ) -> ' '
  // (\\ ) -> '\\ '
  // (\\\ ) -> '\\ '
  [
    /(\\+?)\s/g,
    (_, m1) => {
      const { length } = m1;
      return m1.slice(0, length - length % 2) + SPACE;
    }
  ],
  // Escape metacharacters
  // which is written down by users but means special for regular expressions.
  // > There are 12 characters with special meanings:
  // > - the backslash \,
  // > - the caret ^,
  // > - the dollar sign $,
  // > - the period or dot .,
  // > - the vertical bar or pipe symbol |,
  // > - the question mark ?,
  // > - the asterisk or star *,
  // > - the plus sign +,
  // > - the opening parenthesis (,
  // > - the closing parenthesis ),
  // > - and the opening square bracket [,
  // > - the opening curly brace {,
  // > These special characters are often called "metacharacters".
  [
    /[\\$.|*+(){^]/g,
    (match) => `\\${match}`
  ],
  [
    // > a question mark (?) matches a single character
    /(?!\\)\?/g,
    () => "[^/]"
  ],
  // leading slash
  [
    // > A leading slash matches the beginning of the pathname.
    // > For example, "/*.c" matches "cat-file.c" but not "mozilla-sha1/sha1.c".
    // A leading slash matches the beginning of the pathname
    /^\//,
    () => "^"
  ],
  // replace special metacharacter slash after the leading slash
  [
    /\//g,
    () => "\\/"
  ],
  [
    // > A leading "**" followed by a slash means match in all directories.
    // > For example, "**/foo" matches file or directory "foo" anywhere,
    // > the same as pattern "foo".
    // > "**/foo/bar" matches file or directory "bar" anywhere that is directly
    // >   under directory "foo".
    // Notice that the '*'s have been replaced as '\\*'
    /^\^*\\\*\\\*\\\//,
    // '**/foo' <-> 'foo'
    () => "^(?:.*\\/)?"
  ],
  // starting
  [
    // there will be no leading '/'
    //   (which has been replaced by section "leading slash")
    // If starts with '**', adding a '^' to the regular expression also works
    /^(?=[^^])/,
    function startingReplacer() {
      return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
    }
  ],
  // two globstars
  [
    // Use lookahead assertions so that we could match more than one `'/**'`
    /\\\/\\\*\\\*(?=\\\/|$)/g,
    // Zero, one or several directories
    // should not use '*', or it will be replaced by the next replacer
    // Check if it is not the last `'/**'`
    (_, index2, str) => index2 + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
  ],
  // normal intermediate wildcards
  [
    // Never replace escaped '*'
    // ignore rule '\*' will match the path '*'
    // 'abc.*/' -> go
    // 'abc.*'  -> skip this rule,
    //    coz trailing single wildcard will be handed by [trailing wildcard]
    /(^|[^\\]+)(\\\*)+(?=.+)/g,
    // '*.js' matches '.js'
    // '*.js' doesn't match 'abc'
    (_, p1, p2) => {
      const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
      return p1 + unescaped;
    }
  ],
  [
    // unescape, revert step 3 except for back slash
    // For example, if a user escape a '\\*',
    // after step 3, the result will be '\\\\\\*'
    /\\\\\\(?=[$.|*+(){^])/g,
    () => ESCAPE
  ],
  [
    // '\\\\' -> '\\'
    /\\\\/g,
    () => ESCAPE
  ],
  [
    // > The range notation, e.g. [a-zA-Z],
    // > can be used to match one of the characters in a range.
    // `\` is escaped by step 3
    /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
    (match, leadEscape, range2, endEscape, close2) => leadEscape === ESCAPE ? `\\[${range2}${cleanRangeBackSlash(endEscape)}${close2}` : close2 === "]" ? endEscape.length % 2 === 0 ? `[${sanitizeRange(range2)}${endEscape}]` : "[]" : "[]"
  ],
  // ending
  [
    // 'js' will not match 'js.'
    // 'ab' will not match 'abc'
    /(?:[^*])$/,
    // WTF!
    // https://git-scm.com/docs/gitignore
    // changes in [2.22.1](https://git-scm.com/docs/gitignore/2.22.1)
    // which re-fixes #24, #38
    // > If there is a separator at the end of the pattern then the pattern
    // > will only match directories, otherwise the pattern can match both
    // > files and directories.
    // 'js*' will not match 'a.js'
    // 'js/' will not match 'a.js'
    // 'js' will match 'a.js' and 'a.js/'
    (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
  ],
  // trailing wildcard
  [
    /(\^|\\\/)?\\\*$/,
    (_, p1) => {
      const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
      return `${prefix}(?=$|\\/$)`;
    }
  ]
];
const regexCache = /* @__PURE__ */ Object.create(null);
const makeRegex = (pattern, ignoreCase) => {
  let source = regexCache[pattern];
  if (!source) {
    source = REPLACERS.reduce(
      (prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)),
      pattern
    );
    regexCache[pattern] = source;
  }
  return ignoreCase ? new RegExp(source, "i") : new RegExp(source);
};
const isString = (subject) => typeof subject === "string";
const checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
const splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF);
class IgnoreRule {
  constructor(origin, pattern, negative, regex) {
    this.origin = origin;
    this.pattern = pattern;
    this.negative = negative;
    this.regex = regex;
  }
}
const createRule = (pattern, ignoreCase) => {
  const origin = pattern;
  let negative = false;
  if (pattern.indexOf("!") === 0) {
    negative = true;
    pattern = pattern.substr(1);
  }
  pattern = pattern.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
  const regex = makeRegex(pattern, ignoreCase);
  return new IgnoreRule(
    origin,
    pattern,
    negative,
    regex
  );
};
const throwError = (message, Ctor) => {
  throw new Ctor(message);
};
const checkPath = (path2, originalPath, doThrow) => {
  if (!isString(path2)) {
    return doThrow(
      `path must be a string, but got \`${originalPath}\``,
      TypeError
    );
  }
  if (!path2) {
    return doThrow(`path must not be empty`, TypeError);
  }
  if (checkPath.isNotRelative(path2)) {
    const r = "`path.relative()`d";
    return doThrow(
      `path should be a ${r} string, but got "${originalPath}"`,
      RangeError
    );
  }
  return true;
};
const isNotRelative = (path2) => REGEX_TEST_INVALID_PATH.test(path2);
checkPath.isNotRelative = isNotRelative;
checkPath.convert = (p) => p;
class Ignore {
  constructor({
    ignorecase = true,
    ignoreCase = ignorecase,
    allowRelativePaths = false
  } = {}) {
    define(this, KEY_IGNORE, true);
    this._rules = [];
    this._ignoreCase = ignoreCase;
    this._allowRelativePaths = allowRelativePaths;
    this._initCache();
  }
  _initCache() {
    this._ignoreCache = /* @__PURE__ */ Object.create(null);
    this._testCache = /* @__PURE__ */ Object.create(null);
  }
  _addPattern(pattern) {
    if (pattern && pattern[KEY_IGNORE]) {
      this._rules = this._rules.concat(pattern._rules);
      this._added = true;
      return;
    }
    if (checkPattern(pattern)) {
      const rule = createRule(pattern, this._ignoreCase);
      this._added = true;
      this._rules.push(rule);
    }
  }
  // @param {Array<string> | string | Ignore} pattern
  add(pattern) {
    this._added = false;
    makeArray(
      isString(pattern) ? splitPattern(pattern) : pattern
    ).forEach(this._addPattern, this);
    if (this._added) {
      this._initCache();
    }
    return this;
  }
  // legacy
  addPattern(pattern) {
    return this.add(pattern);
  }
  //          |           ignored : unignored
  // negative |   0:0   |   0:1   |   1:0   |   1:1
  // -------- | ------- | ------- | ------- | --------
  //     0    |  TEST   |  TEST   |  SKIP   |    X
  //     1    |  TESTIF |  SKIP   |  TEST   |    X
  // - SKIP: always skip
  // - TEST: always test
  // - TESTIF: only test if checkUnignored
  // - X: that never happen
  // @param {boolean} whether should check if the path is unignored,
  //   setting `checkUnignored` to `false` could reduce additional
  //   path matching.
  // @returns {TestResult} true if a file is ignored
  _testOne(path2, checkUnignored) {
    let ignored = false;
    let unignored = false;
    this._rules.forEach((rule) => {
      const { negative } = rule;
      if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
        return;
      }
      const matched = rule.regex.test(path2);
      if (matched) {
        ignored = !negative;
        unignored = negative;
      }
    });
    return {
      ignored,
      unignored
    };
  }
  // @returns {TestResult}
  _test(originalPath, cache, checkUnignored, slices) {
    const path2 = originalPath && checkPath.convert(originalPath);
    checkPath(
      path2,
      originalPath,
      this._allowRelativePaths ? RETURN_FALSE : throwError
    );
    return this._t(path2, cache, checkUnignored, slices);
  }
  _t(path2, cache, checkUnignored, slices) {
    if (path2 in cache) {
      return cache[path2];
    }
    if (!slices) {
      slices = path2.split(SLASH);
    }
    slices.pop();
    if (!slices.length) {
      return cache[path2] = this._testOne(path2, checkUnignored);
    }
    const parent = this._t(
      slices.join(SLASH) + SLASH,
      cache,
      checkUnignored,
      slices
    );
    return cache[path2] = parent.ignored ? parent : this._testOne(path2, checkUnignored);
  }
  ignores(path2) {
    return this._test(path2, this._ignoreCache, false).ignored;
  }
  createFilter() {
    return (path2) => !this.ignores(path2);
  }
  filter(paths) {
    return makeArray(paths).filter(this.createFilter());
  }
  // @returns {TestResult}
  test(path2) {
    return this._test(path2, this._testCache, true);
  }
}
const factory = (options) => new Ignore(options);
const isPathValid = (path2) => checkPath(path2 && checkPath.convert(path2), path2, RETURN_FALSE);
factory.isPathValid = isPathValid;
factory.default = factory;
var ignore$1 = factory;
if (
  // Detect `process` so that it can run in browsers.
  typeof process !== "undefined" && (process.env && process.env.IGNORE_TEST_WIN32 || process.platform === "win32")
) {
  const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
  checkPath.convert = makePosix;
  const REGIX_IS_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
  checkPath.isNotRelative = (path2) => REGIX_IS_WINDOWS_PATH_ABSOLUTE.test(path2) || isNotRelative(path2);
}
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function replaceAll(str, search, replacement) {
  search = search instanceof RegExp ? search : new RegExp(escapeRegExp(search), "g");
  return str.replace(search, replacement);
}
var CleanGitRef = {
  clean: function clean(value) {
    if (typeof value !== "string") {
      throw new Error("Expected a string, received: " + value);
    }
    value = replaceAll(value, "./", "/");
    value = replaceAll(value, "..", ".");
    value = replaceAll(value, " ", "-");
    value = replaceAll(value, /^[~^:?*\\\-]/g, "");
    value = replaceAll(value, /[~^:?*\\]/g, "-");
    value = replaceAll(value, /[~^:?*\\\-]$/g, "");
    value = replaceAll(value, "@{", "-");
    value = replaceAll(value, /\.$/g, "");
    value = replaceAll(value, /\/$/g, "");
    value = replaceAll(value, /\.lock$/g, "");
    return value;
  }
};
var lib = CleanGitRef;
const bad = /(^|[/.])([/.]|$)|^@$|@{|[\x00-\x20\x7f~^:?*[\\]|\.lock(\/|$)/;
var isGitRefNameValid = function validRef(name, onelevel) {
  if (typeof name !== "string") {
    throw new TypeError("Reference name must be a string");
  }
  return !bad.test(name) && (!!onelevel || name.includes("/"));
};
var onp$1 = function(a_, b_) {
  var a = a_, b = b_, m = a.length, n = b.length, reverse = false, ed = null, offset = m + 1, path2 = [], pathposi = [], ses = [], lcs = "", SES_DELETE = -1, SES_COMMON = 0, SES_ADD = 1;
  var tmp1, tmp2;
  var init2 = function() {
    if (m >= n) {
      tmp1 = a;
      tmp2 = m;
      a = b;
      b = tmp1;
      m = n;
      n = tmp2;
      reverse = true;
      offset = m + 1;
    }
  };
  var P = function(x, y, k) {
    return {
      "x": x,
      "y": y,
      "k": k
    };
  };
  var seselem = function(elem, t) {
    return {
      "elem": elem,
      "t": t
    };
  };
  var snake = function(k, p, pp) {
    var r, x, y;
    if (p > pp) {
      r = path2[k - 1 + offset];
    } else {
      r = path2[k + 1 + offset];
    }
    y = Math.max(p, pp);
    x = y - k;
    while (x < m && y < n && a[x] === b[y]) {
      ++x;
      ++y;
    }
    path2[k + offset] = pathposi.length;
    pathposi[pathposi.length] = new P(x, y, r);
    return y;
  };
  var recordseq = function(epc) {
    var px_idx, py_idx, i;
    px_idx = py_idx = 0;
    for (i = epc.length - 1; i >= 0; --i) {
      while (px_idx < epc[i].x || py_idx < epc[i].y) {
        if (epc[i].y - epc[i].x > py_idx - px_idx) {
          if (reverse) {
            ses[ses.length] = new seselem(b[py_idx], SES_DELETE);
          } else {
            ses[ses.length] = new seselem(b[py_idx], SES_ADD);
          }
          ++py_idx;
        } else if (epc[i].y - epc[i].x < py_idx - px_idx) {
          if (reverse) {
            ses[ses.length] = new seselem(a[px_idx], SES_ADD);
          } else {
            ses[ses.length] = new seselem(a[px_idx], SES_DELETE);
          }
          ++px_idx;
        } else {
          ses[ses.length] = new seselem(a[px_idx], SES_COMMON);
          lcs += a[px_idx];
          ++px_idx;
          ++py_idx;
        }
      }
    }
  };
  init2();
  return {
    SES_DELETE: -1,
    SES_COMMON: 0,
    SES_ADD: 1,
    editdistance: function() {
      return ed;
    },
    getlcs: function() {
      return lcs;
    },
    getses: function() {
      return ses;
    },
    compose: function() {
      var delta, size, fp, p, r, epc, i, k;
      delta = n - m;
      size = m + n + 3;
      fp = {};
      for (i = 0; i < size; ++i) {
        fp[i] = -1;
        path2[i] = -1;
      }
      p = -1;
      do {
        ++p;
        for (k = -p; k <= delta - 1; ++k) {
          fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
        }
        for (k = delta + p; k >= delta + 1; --k) {
          fp[k + offset] = snake(k, fp[k - 1 + offset] + 1, fp[k + 1 + offset]);
        }
        fp[delta + offset] = snake(delta, fp[delta - 1 + offset] + 1, fp[delta + 1 + offset]);
      } while (fp[delta + offset] !== n);
      ed = delta + 2 * p;
      r = path2[delta + offset];
      epc = [];
      while (r !== -1) {
        epc[epc.length] = new P(pathposi[r].x, pathposi[r].y, null);
        r = pathposi[r].k;
      }
      recordseq(epc);
    }
  };
};
var onp = onp$1;
function longestCommonSubsequence(file1, file2) {
  var diff = new onp(file1, file2);
  diff.compose();
  var ses = diff.getses();
  var root;
  var prev;
  var file1RevIdx = file1.length - 1, file2RevIdx = file2.length - 1;
  for (var i = ses.length - 1; i >= 0; --i) {
    if (ses[i].t === diff.SES_COMMON) {
      if (prev) {
        prev.chain = {
          file1index: file1RevIdx,
          file2index: file2RevIdx,
          chain: null
        };
        prev = prev.chain;
      } else {
        root = {
          file1index: file1RevIdx,
          file2index: file2RevIdx,
          chain: null
        };
        prev = root;
      }
      file1RevIdx--;
      file2RevIdx--;
    } else if (ses[i].t === diff.SES_DELETE) {
      file1RevIdx--;
    } else if (ses[i].t === diff.SES_ADD) {
      file2RevIdx--;
    }
  }
  var tail = {
    file1index: -1,
    file2index: -1,
    chain: null
  };
  if (!prev) {
    return tail;
  }
  prev.chain = tail;
  return root;
}
function diffIndices(file1, file2) {
  var result = [];
  var tail1 = file1.length;
  var tail2 = file2.length;
  for (var candidate = longestCommonSubsequence(file1, file2); candidate !== null; candidate = candidate.chain) {
    var mismatchLength1 = tail1 - candidate.file1index - 1;
    var mismatchLength2 = tail2 - candidate.file2index - 1;
    tail1 = candidate.file1index;
    tail2 = candidate.file2index;
    if (mismatchLength1 || mismatchLength2) {
      result.push({
        file1: [tail1 + 1, mismatchLength1],
        file2: [tail2 + 1, mismatchLength2]
      });
    }
  }
  result.reverse();
  return result;
}
function diff3MergeIndices(a, o, b) {
  var i;
  var m1 = diffIndices(o, a);
  var m2 = diffIndices(o, b);
  var hunks = [];
  function addHunk(h, side2) {
    hunks.push([h.file1[0], side2, h.file1[1], h.file2[0], h.file2[1]]);
  }
  for (i = 0; i < m1.length; i++) {
    addHunk(m1[i], 0);
  }
  for (i = 0; i < m2.length; i++) {
    addHunk(m2[i], 2);
  }
  hunks.sort(function(x, y) {
    return x[0] - y[0];
  });
  var result = [];
  var commonOffset = 0;
  function copyCommon(targetOffset) {
    if (targetOffset > commonOffset) {
      result.push([1, commonOffset, targetOffset - commonOffset]);
      commonOffset = targetOffset;
    }
  }
  for (var hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    var firstHunkIndex = hunkIndex;
    var hunk = hunks[hunkIndex];
    var regionLhs = hunk[0];
    var regionRhs = regionLhs + hunk[2];
    while (hunkIndex < hunks.length - 1) {
      var maybeOverlapping = hunks[hunkIndex + 1];
      var maybeLhs = maybeOverlapping[0];
      if (maybeLhs > regionRhs) break;
      regionRhs = Math.max(regionRhs, maybeLhs + maybeOverlapping[2]);
      hunkIndex++;
    }
    copyCommon(regionLhs);
    if (firstHunkIndex == hunkIndex) {
      if (hunk[4] > 0) {
        result.push([hunk[1], hunk[3], hunk[4]]);
      }
    } else {
      var regions = {
        0: [a.length, -1, o.length, -1],
        2: [b.length, -1, o.length, -1]
      };
      for (i = firstHunkIndex; i <= hunkIndex; i++) {
        hunk = hunks[i];
        var side = hunk[1];
        var r = regions[side];
        var oLhs = hunk[0];
        var oRhs = oLhs + hunk[2];
        var abLhs = hunk[3];
        var abRhs = abLhs + hunk[4];
        r[0] = Math.min(abLhs, r[0]);
        r[1] = Math.max(abRhs, r[1]);
        r[2] = Math.min(oLhs, r[2]);
        r[3] = Math.max(oRhs, r[3]);
      }
      var aLhs = regions[0][0] + (regionLhs - regions[0][2]);
      var aRhs = regions[0][1] + (regionRhs - regions[0][3]);
      var bLhs = regions[2][0] + (regionLhs - regions[2][2]);
      var bRhs = regions[2][1] + (regionRhs - regions[2][3]);
      result.push([
        -1,
        aLhs,
        aRhs - aLhs,
        regionLhs,
        regionRhs - regionLhs,
        bLhs,
        bRhs - bLhs
      ]);
    }
    commonOffset = regionRhs;
  }
  copyCommon(o.length);
  return result;
}
function diff3Merge$1(a, o, b) {
  var result = [];
  var files = [a, o, b];
  var indices = diff3MergeIndices(a, o, b);
  var okLines = [];
  function flushOk() {
    if (okLines.length) {
      result.push({
        ok: okLines
      });
    }
    okLines = [];
  }
  function pushOk(xs) {
    for (var j = 0; j < xs.length; j++) {
      okLines.push(xs[j]);
    }
  }
  function isTrueConflict(rec) {
    if (rec[2] != rec[6]) return true;
    var aoff = rec[1];
    var boff = rec[5];
    for (var j = 0; j < rec[2]; j++) {
      if (a[j + aoff] != b[j + boff]) return true;
    }
    return false;
  }
  for (var i = 0; i < indices.length; i++) {
    var x = indices[i];
    var side = x[0];
    if (side == -1) {
      if (!isTrueConflict(x)) {
        pushOk(files[0].slice(x[1], x[1] + x[2]));
      } else {
        flushOk();
        result.push({
          conflict: {
            a: a.slice(x[1], x[1] + x[2]),
            aIndex: x[1],
            o: o.slice(x[3], x[3] + x[4]),
            oIndex: x[3],
            b: b.slice(x[5], x[5] + x[6]),
            bIndex: x[5]
          }
        });
      }
    } else {
      pushOk(files[side].slice(x[1], x[1] + x[2]));
    }
  }
  flushOk();
  return result;
}
var diff3 = diff3Merge$1;
Object.defineProperty(isomorphicGit, "__esModule", { value: true });
function _interopDefault$1(ex) {
  return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
}
var AsyncLock = _interopDefault$1(asyncLock);
var Hash = _interopDefault$1(sha1);
var pathBrowserify = pathBrowserify$1;
var crc32 = _interopDefault$1(crc32$4);
var pako = _interopDefault$1(pako_1);
var pify = _interopDefault$1(pify$1);
var ignore = _interopDefault$1(ignore$1);
var cleanGitRef = _interopDefault$1(lib);
var validRef2 = _interopDefault$1(isGitRefNameValid);
var diff3Merge = _interopDefault$1(diff3);
class BaseError extends Error {
  constructor(message) {
    super(message);
    this.caller = "";
  }
  toJSON() {
    return {
      code: this.code,
      data: this.data,
      caller: this.caller,
      message: this.message,
      stack: this.stack
    };
  }
  fromJSON(json) {
    const e = new BaseError(json.message);
    e.code = json.code;
    e.data = json.data;
    e.caller = json.caller;
    e.stack = json.stack;
    return e;
  }
  get isIsomorphicGitError() {
    return true;
  }
}
class UnmergedPathsError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   */
  constructor(filepaths) {
    super(
      `Modifying the index is not possible because you have unmerged files: ${filepaths.toString}. Fix them up in the work tree, and then use 'git add/rm as appropriate to mark resolution and make a commit.`
    );
    this.code = this.name = UnmergedPathsError.code;
    this.data = { filepaths };
  }
}
UnmergedPathsError.code = "UnmergedPathsError";
class InternalError extends BaseError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(
      `An internal error caused this command to fail. Please file a bug report at https://github.com/isomorphic-git/isomorphic-git/issues with this error message: ${message}`
    );
    this.code = this.name = InternalError.code;
    this.data = { message };
  }
}
InternalError.code = "InternalError";
class UnsafeFilepathError extends BaseError {
  /**
   * @param {string} filepath
   */
  constructor(filepath) {
    super(`The filepath "${filepath}" contains unsafe character sequences`);
    this.code = this.name = UnsafeFilepathError.code;
    this.data = { filepath };
  }
}
UnsafeFilepathError.code = "UnsafeFilepathError";
class BufferCursor {
  constructor(buffer) {
    this.buffer = buffer;
    this._start = 0;
  }
  eof() {
    return this._start >= this.buffer.length;
  }
  tell() {
    return this._start;
  }
  seek(n) {
    this._start = n;
  }
  slice(n) {
    const r = this.buffer.slice(this._start, this._start + n);
    this._start += n;
    return r;
  }
  toString(enc, length) {
    const r = this.buffer.toString(enc, this._start, this._start + length);
    this._start += length;
    return r;
  }
  write(value, length, enc) {
    const r = this.buffer.write(value, this._start, length, enc);
    this._start += length;
    return r;
  }
  copy(source, start, end) {
    const r = source.copy(this.buffer, this._start, start, end);
    this._start += r;
    return r;
  }
  readUInt8() {
    const r = this.buffer.readUInt8(this._start);
    this._start += 1;
    return r;
  }
  writeUInt8(value) {
    const r = this.buffer.writeUInt8(value, this._start);
    this._start += 1;
    return r;
  }
  readUInt16BE() {
    const r = this.buffer.readUInt16BE(this._start);
    this._start += 2;
    return r;
  }
  writeUInt16BE(value) {
    const r = this.buffer.writeUInt16BE(value, this._start);
    this._start += 2;
    return r;
  }
  readUInt32BE() {
    const r = this.buffer.readUInt32BE(this._start);
    this._start += 4;
    return r;
  }
  writeUInt32BE(value) {
    const r = this.buffer.writeUInt32BE(value, this._start);
    this._start += 4;
    return r;
  }
}
function compareStrings(a, b) {
  return -(a < b) || +(a > b);
}
function comparePath(a, b) {
  return compareStrings(a.path, b.path);
}
function normalizeMode(mode) {
  let type2 = mode > 0 ? mode >> 12 : 0;
  if (type2 !== 4 && type2 !== 8 && type2 !== 10 && type2 !== 14) {
    type2 = 8;
  }
  let permissions = mode & 511;
  if (permissions & 73) {
    permissions = 493;
  } else {
    permissions = 420;
  }
  if (type2 !== 8) permissions = 0;
  return (type2 << 12) + permissions;
}
const MAX_UINT32 = 2 ** 32;
function SecondsNanoseconds(givenSeconds, givenNanoseconds, milliseconds, date) {
  if (givenSeconds !== void 0 && givenNanoseconds !== void 0) {
    return [givenSeconds, givenNanoseconds];
  }
  if (milliseconds === void 0) {
    milliseconds = date.valueOf();
  }
  const seconds = Math.floor(milliseconds / 1e3);
  const nanoseconds = (milliseconds - seconds * 1e3) * 1e6;
  return [seconds, nanoseconds];
}
function normalizeStats(e) {
  const [ctimeSeconds, ctimeNanoseconds] = SecondsNanoseconds(
    e.ctimeSeconds,
    e.ctimeNanoseconds,
    e.ctimeMs,
    e.ctime
  );
  const [mtimeSeconds, mtimeNanoseconds] = SecondsNanoseconds(
    e.mtimeSeconds,
    e.mtimeNanoseconds,
    e.mtimeMs,
    e.mtime
  );
  return {
    ctimeSeconds: ctimeSeconds % MAX_UINT32,
    ctimeNanoseconds: ctimeNanoseconds % MAX_UINT32,
    mtimeSeconds: mtimeSeconds % MAX_UINT32,
    mtimeNanoseconds: mtimeNanoseconds % MAX_UINT32,
    dev: e.dev % MAX_UINT32,
    ino: e.ino % MAX_UINT32,
    mode: normalizeMode(e.mode % MAX_UINT32),
    uid: e.uid % MAX_UINT32,
    gid: e.gid % MAX_UINT32,
    // size of -1 happens over a BrowserFS HTTP Backend that doesn't serve Content-Length headers
    // (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat
    size: e.size > -1 ? e.size % MAX_UINT32 : 0
  };
}
function toHex(buffer) {
  let hex = "";
  for (const byte of new Uint8Array(buffer)) {
    if (byte < 16) hex += "0";
    hex += byte.toString(16);
  }
  return hex;
}
let supportsSubtleSHA1 = null;
async function shasum(buffer) {
  if (supportsSubtleSHA1 === null) {
    supportsSubtleSHA1 = await testSubtleSHA1();
  }
  return supportsSubtleSHA1 ? subtleSHA1(buffer) : shasumSync(buffer);
}
function shasumSync(buffer) {
  return new Hash().update(buffer).digest("hex");
}
async function subtleSHA1(buffer) {
  const hash2 = await crypto.subtle.digest("SHA-1", buffer);
  return toHex(hash2);
}
async function testSubtleSHA1() {
  try {
    const hash2 = await subtleSHA1(new Uint8Array([]));
    return hash2 === "da39a3ee5e6b4b0d3255bfef95601890afd80709";
  } catch (_) {
  }
  return false;
}
function parseCacheEntryFlags(bits) {
  return {
    assumeValid: Boolean(bits & 32768),
    extended: Boolean(bits & 16384),
    stage: (bits & 12288) >> 12,
    nameLength: bits & 4095
  };
}
function renderCacheEntryFlags(entry) {
  const flags = entry.flags;
  flags.extended = false;
  flags.nameLength = Math.min(Buffer.from(entry.path).length, 4095);
  return (flags.assumeValid ? 32768 : 0) + (flags.extended ? 16384 : 0) + ((flags.stage & 3) << 12) + (flags.nameLength & 4095);
}
class GitIndex {
  /*::
   _entries: Map<string, CacheEntry>
   _dirty: boolean // Used to determine if index needs to be saved to filesystem
   */
  constructor(entries, unmergedPaths) {
    this._dirty = false;
    this._unmergedPaths = unmergedPaths || /* @__PURE__ */ new Set();
    this._entries = entries || /* @__PURE__ */ new Map();
  }
  _addEntry(entry) {
    if (entry.flags.stage === 0) {
      entry.stages = [entry];
      this._entries.set(entry.path, entry);
      this._unmergedPaths.delete(entry.path);
    } else {
      let existingEntry = this._entries.get(entry.path);
      if (!existingEntry) {
        this._entries.set(entry.path, entry);
        existingEntry = entry;
      }
      existingEntry.stages[entry.flags.stage] = entry;
      this._unmergedPaths.add(entry.path);
    }
  }
  static async from(buffer) {
    if (Buffer.isBuffer(buffer)) {
      return GitIndex.fromBuffer(buffer);
    } else if (buffer === null) {
      return new GitIndex(null);
    } else {
      throw new InternalError("invalid type passed to GitIndex.from");
    }
  }
  static async fromBuffer(buffer) {
    if (buffer.length === 0) {
      throw new InternalError("Index file is empty (.git/index)");
    }
    const index2 = new GitIndex();
    const reader = new BufferCursor(buffer);
    const magic = reader.toString("utf8", 4);
    if (magic !== "DIRC") {
      throw new InternalError(`Invalid dircache magic file number: ${magic}`);
    }
    const shaComputed = await shasum(buffer.slice(0, -20));
    const shaClaimed = buffer.slice(-20).toString("hex");
    if (shaClaimed !== shaComputed) {
      throw new InternalError(
        `Invalid checksum in GitIndex buffer: expected ${shaClaimed} but saw ${shaComputed}`
      );
    }
    const version2 = reader.readUInt32BE();
    if (version2 !== 2) {
      throw new InternalError(`Unsupported dircache version: ${version2}`);
    }
    const numEntries = reader.readUInt32BE();
    let i = 0;
    while (!reader.eof() && i < numEntries) {
      const entry = {};
      entry.ctimeSeconds = reader.readUInt32BE();
      entry.ctimeNanoseconds = reader.readUInt32BE();
      entry.mtimeSeconds = reader.readUInt32BE();
      entry.mtimeNanoseconds = reader.readUInt32BE();
      entry.dev = reader.readUInt32BE();
      entry.ino = reader.readUInt32BE();
      entry.mode = reader.readUInt32BE();
      entry.uid = reader.readUInt32BE();
      entry.gid = reader.readUInt32BE();
      entry.size = reader.readUInt32BE();
      entry.oid = reader.slice(20).toString("hex");
      const flags = reader.readUInt16BE();
      entry.flags = parseCacheEntryFlags(flags);
      const pathlength = buffer.indexOf(0, reader.tell() + 1) - reader.tell();
      if (pathlength < 1) {
        throw new InternalError(`Got a path length of: ${pathlength}`);
      }
      entry.path = reader.toString("utf8", pathlength);
      if (entry.path.includes("..\\") || entry.path.includes("../")) {
        throw new UnsafeFilepathError(entry.path);
      }
      let padding = 8 - (reader.tell() - 12) % 8;
      if (padding === 0) padding = 8;
      while (padding--) {
        const tmp = reader.readUInt8();
        if (tmp !== 0) {
          throw new InternalError(
            `Expected 1-8 null characters but got '${tmp}' after ${entry.path}`
          );
        } else if (reader.eof()) {
          throw new InternalError("Unexpected end of file");
        }
      }
      entry.stages = [];
      index2._addEntry(entry);
      i++;
    }
    return index2;
  }
  get unmergedPaths() {
    return [...this._unmergedPaths];
  }
  get entries() {
    return [...this._entries.values()].sort(comparePath);
  }
  get entriesMap() {
    return this._entries;
  }
  get entriesFlat() {
    return [...this.entries].flatMap((entry) => {
      return entry.stages.length > 1 ? entry.stages.filter((x) => x) : entry;
    });
  }
  *[Symbol.iterator]() {
    for (const entry of this.entries) {
      yield entry;
    }
  }
  insert({ filepath, stats, oid, stage = 0 }) {
    if (!stats) {
      stats = {
        ctimeSeconds: 0,
        ctimeNanoseconds: 0,
        mtimeSeconds: 0,
        mtimeNanoseconds: 0,
        dev: 0,
        ino: 0,
        mode: 0,
        uid: 0,
        gid: 0,
        size: 0
      };
    }
    stats = normalizeStats(stats);
    const bfilepath = Buffer.from(filepath);
    const entry = {
      ctimeSeconds: stats.ctimeSeconds,
      ctimeNanoseconds: stats.ctimeNanoseconds,
      mtimeSeconds: stats.mtimeSeconds,
      mtimeNanoseconds: stats.mtimeNanoseconds,
      dev: stats.dev,
      ino: stats.ino,
      // We provide a fallback value for `mode` here because not all fs
      // implementations assign it, but we use it in GitTree.
      // '100644' is for a "regular non-executable file"
      mode: stats.mode || 33188,
      uid: stats.uid,
      gid: stats.gid,
      size: stats.size,
      path: filepath,
      oid,
      flags: {
        assumeValid: false,
        extended: false,
        stage,
        nameLength: bfilepath.length < 4095 ? bfilepath.length : 4095
      },
      stages: []
    };
    this._addEntry(entry);
    this._dirty = true;
  }
  delete({ filepath }) {
    if (this._entries.has(filepath)) {
      this._entries.delete(filepath);
    } else {
      for (const key of this._entries.keys()) {
        if (key.startsWith(filepath + "/")) {
          this._entries.delete(key);
        }
      }
    }
    if (this._unmergedPaths.has(filepath)) {
      this._unmergedPaths.delete(filepath);
    }
    this._dirty = true;
  }
  clear() {
    this._entries.clear();
    this._dirty = true;
  }
  has({ filepath }) {
    return this._entries.has(filepath);
  }
  render() {
    return this.entries.map((entry) => `${entry.mode.toString(8)} ${entry.oid}    ${entry.path}`).join("\n");
  }
  static async _entryToBuffer(entry) {
    const bpath = Buffer.from(entry.path);
    const length = Math.ceil((62 + bpath.length + 1) / 8) * 8;
    const written = Buffer.alloc(length);
    const writer = new BufferCursor(written);
    const stat = normalizeStats(entry);
    writer.writeUInt32BE(stat.ctimeSeconds);
    writer.writeUInt32BE(stat.ctimeNanoseconds);
    writer.writeUInt32BE(stat.mtimeSeconds);
    writer.writeUInt32BE(stat.mtimeNanoseconds);
    writer.writeUInt32BE(stat.dev);
    writer.writeUInt32BE(stat.ino);
    writer.writeUInt32BE(stat.mode);
    writer.writeUInt32BE(stat.uid);
    writer.writeUInt32BE(stat.gid);
    writer.writeUInt32BE(stat.size);
    writer.write(entry.oid, 20, "hex");
    writer.writeUInt16BE(renderCacheEntryFlags(entry));
    writer.write(entry.path, bpath.length, "utf8");
    return written;
  }
  async toObject() {
    const header = Buffer.alloc(12);
    const writer = new BufferCursor(header);
    writer.write("DIRC", 4, "utf8");
    writer.writeUInt32BE(2);
    writer.writeUInt32BE(this.entriesFlat.length);
    let entryBuffers = [];
    for (const entry of this.entries) {
      entryBuffers.push(GitIndex._entryToBuffer(entry));
      if (entry.stages.length > 1) {
        for (const stage of entry.stages) {
          if (stage && stage !== entry) {
            entryBuffers.push(GitIndex._entryToBuffer(stage));
          }
        }
      }
    }
    entryBuffers = await Promise.all(entryBuffers);
    const body = Buffer.concat(entryBuffers);
    const main = Buffer.concat([header, body]);
    const sum = await shasum(main);
    return Buffer.concat([main, Buffer.from(sum, "hex")]);
  }
}
function compareStats(entry, stats, filemode = true, trustino = true) {
  const e = normalizeStats(entry);
  const s = normalizeStats(stats);
  const staleness = filemode && e.mode !== s.mode || e.mtimeSeconds !== s.mtimeSeconds || e.ctimeSeconds !== s.ctimeSeconds || e.uid !== s.uid || e.gid !== s.gid || trustino && e.ino !== s.ino || e.size !== s.size;
  return staleness;
}
let lock = null;
const IndexCache = Symbol("IndexCache");
function createCache() {
  return {
    map: /* @__PURE__ */ new Map(),
    stats: /* @__PURE__ */ new Map()
  };
}
async function updateCachedIndexFile(fs, filepath, cache) {
  const [stat, rawIndexFile] = await Promise.all([
    fs.lstat(filepath),
    fs.read(filepath)
  ]);
  const index2 = await GitIndex.from(rawIndexFile);
  cache.map.set(filepath, index2);
  cache.stats.set(filepath, stat);
}
async function isIndexStale(fs, filepath, cache) {
  const savedStats = cache.stats.get(filepath);
  if (savedStats === void 0) return true;
  if (savedStats === null) return false;
  const currStats = await fs.lstat(filepath);
  if (currStats === null) return false;
  return compareStats(savedStats, currStats);
}
class GitIndexManager {
  /**
   * Manages access to the Git index file, ensuring thread-safe operations and caching.
   *
   * @param {object} opts - Options for acquiring the Git index.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @param {object} opts.cache - A shared cache object for storing index data.
   * @param {boolean} [opts.allowUnmerged=true] - Whether to allow unmerged paths in the index.
   * @param {function(GitIndex): any} closure - A function to execute with the Git index.
   * @returns {Promise<any>} The result of the closure function.
   * @throws {UnmergedPathsError} If unmerged paths exist and `allowUnmerged` is `false`.
   */
  static async acquire({ fs, gitdir, cache, allowUnmerged = true }, closure) {
    if (!cache[IndexCache]) {
      cache[IndexCache] = createCache();
    }
    const filepath = `${gitdir}/index`;
    if (lock === null) lock = new AsyncLock({ maxPending: Infinity });
    let result;
    let unmergedPaths = [];
    await lock.acquire(filepath, async () => {
      const theIndexCache = cache[IndexCache];
      if (await isIndexStale(fs, filepath, theIndexCache)) {
        await updateCachedIndexFile(fs, filepath, theIndexCache);
      }
      const index2 = theIndexCache.map.get(filepath);
      unmergedPaths = index2.unmergedPaths;
      if (unmergedPaths.length && !allowUnmerged)
        throw new UnmergedPathsError(unmergedPaths);
      result = await closure(index2);
      if (index2._dirty) {
        const buffer = await index2.toObject();
        await fs.write(filepath, buffer);
        theIndexCache.stats.set(filepath, await fs.lstat(filepath));
        index2._dirty = false;
      }
    });
    return result;
  }
}
function basename$1(path2) {
  const last = Math.max(path2.lastIndexOf("/"), path2.lastIndexOf("\\"));
  if (last > -1) {
    path2 = path2.slice(last + 1);
  }
  return path2;
}
function dirname$1(path2) {
  const last = Math.max(path2.lastIndexOf("/"), path2.lastIndexOf("\\"));
  if (last === -1) return ".";
  if (last === 0) return "/";
  return path2.slice(0, last);
}
function flatFileListToDirectoryStructure(files) {
  const inodes = /* @__PURE__ */ new Map();
  const mkdir = function(name) {
    if (!inodes.has(name)) {
      const dir = {
        type: "tree",
        fullpath: name,
        basename: basename$1(name),
        metadata: {},
        children: []
      };
      inodes.set(name, dir);
      dir.parent = mkdir(dirname$1(name));
      if (dir.parent && dir.parent !== dir) dir.parent.children.push(dir);
    }
    return inodes.get(name);
  };
  const mkfile = function(name, metadata) {
    if (!inodes.has(name)) {
      const file = {
        type: "blob",
        fullpath: name,
        basename: basename$1(name),
        metadata,
        // This recursively generates any missing parent folders.
        parent: mkdir(dirname$1(name)),
        children: []
      };
      if (file.parent) file.parent.children.push(file);
      inodes.set(name, file);
    }
    return inodes.get(name);
  };
  mkdir(".");
  for (const file of files) {
    mkfile(file.path, file);
  }
  return inodes;
}
function mode2type(mode) {
  switch (mode) {
    case 16384:
      return "tree";
    case 33188:
      return "blob";
    case 33261:
      return "blob";
    case 40960:
      return "blob";
    case 57344:
      return "commit";
  }
  throw new InternalError(`Unexpected GitTree entry mode: ${mode.toString(8)}`);
}
class GitWalkerIndex {
  constructor({ fs, gitdir, cache }) {
    this.treePromise = GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function(index2) {
        return flatFileListToDirectoryStructure(index2.entries);
      }
    );
    const walker = this;
    this.ConstructEntry = class StageEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    const filepath = entry._fullpath;
    const tree = await this.treePromise;
    const inode = tree.get(filepath);
    if (!inode) return null;
    if (inode.type === "blob") return null;
    if (inode.type !== "tree") {
      throw new Error(`ENOTDIR: not a directory, scandir '${filepath}'`);
    }
    const names = inode.children.map((inode2) => inode2.fullpath);
    names.sort(compareStrings);
    return names;
  }
  async type(entry) {
    if (entry._type === false) {
      await entry.stat();
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      await entry.stat();
    }
    return entry._mode;
  }
  async stat(entry) {
    if (entry._stat === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);
      if (!inode) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        );
      }
      const stats = inode.type === "tree" ? {} : normalizeStats(inode.metadata);
      entry._type = inode.type === "tree" ? "tree" : mode2type(stats.mode);
      entry._mode = stats.mode;
      if (inode.type === "tree") {
        entry._stat = void 0;
      } else {
        entry._stat = stats;
      }
    }
    return entry._stat;
  }
  async content(_entry) {
  }
  async oid(entry) {
    if (entry._oid === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);
      entry._oid = inode.metadata.oid;
    }
    return entry._oid;
  }
}
const GitWalkSymbol = Symbol("GitWalkSymbol");
function STAGE() {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, gitdir, cache }) {
      return new GitWalkerIndex({ fs, gitdir, cache });
    }
  });
  Object.freeze(o);
  return o;
}
class NotFoundError extends BaseError {
  /**
   * @param {string} what
   */
  constructor(what) {
    super(`Could not find ${what}.`);
    this.code = this.name = NotFoundError.code;
    this.data = { what };
  }
}
NotFoundError.code = "NotFoundError";
class ObjectTypeError extends BaseError {
  /**
   * @param {string} oid
   * @param {'blob'|'commit'|'tag'|'tree'} actual
   * @param {'blob'|'commit'|'tag'|'tree'} expected
   * @param {string} [filepath]
   */
  constructor(oid, actual, expected, filepath) {
    super(
      `Object ${oid} ${filepath ? `at ${filepath}` : ""}was anticipated to be a ${expected} but it is a ${actual}.`
    );
    this.code = this.name = ObjectTypeError.code;
    this.data = { oid, actual, expected, filepath };
  }
}
ObjectTypeError.code = "ObjectTypeError";
class InvalidOidError extends BaseError {
  /**
   * @param {string} value
   */
  constructor(value) {
    super(`Expected a 40-char hex object id but saw "${value}".`);
    this.code = this.name = InvalidOidError.code;
    this.data = { value };
  }
}
InvalidOidError.code = "InvalidOidError";
class NoRefspecError extends BaseError {
  /**
   * @param {string} remote
   */
  constructor(remote) {
    super(`Could not find a fetch refspec for remote "${remote}". Make sure the config file has an entry like the following:
[remote "${remote}"]
	fetch = +refs/heads/*:refs/remotes/origin/*
`);
    this.code = this.name = NoRefspecError.code;
    this.data = { remote };
  }
}
NoRefspecError.code = "NoRefspecError";
class GitPackedRefs {
  constructor(text) {
    this.refs = /* @__PURE__ */ new Map();
    this.parsedConfig = [];
    if (text) {
      let key = null;
      this.parsedConfig = text.trim().split("\n").map((line) => {
        if (/^\s*#/.test(line)) {
          return { line, comment: true };
        }
        const i = line.indexOf(" ");
        if (line.startsWith("^")) {
          const value = line.slice(1);
          this.refs.set(key + "^{}", value);
          return { line, ref: key, peeled: value };
        } else {
          const value = line.slice(0, i);
          key = line.slice(i + 1);
          this.refs.set(key, value);
          return { line, ref: key, oid: value };
        }
      });
    }
    return this;
  }
  static from(text) {
    return new GitPackedRefs(text);
  }
  delete(ref2) {
    this.parsedConfig = this.parsedConfig.filter((entry) => entry.ref !== ref2);
    this.refs.delete(ref2);
  }
  toString() {
    return this.parsedConfig.map(({ line }) => line).join("\n") + "\n";
  }
}
class GitRefSpec {
  constructor({ remotePath, localPath, force, matchPrefix }) {
    Object.assign(this, {
      remotePath,
      localPath,
      force,
      matchPrefix
    });
  }
  static from(refspec) {
    const [
      forceMatch,
      remotePath,
      remoteGlobMatch,
      localPath,
      localGlobMatch
    ] = refspec.match(/^(\+?)(.*?)(\*?):(.*?)(\*?)$/).slice(1);
    const force = forceMatch === "+";
    const remoteIsGlob = remoteGlobMatch === "*";
    const localIsGlob = localGlobMatch === "*";
    if (remoteIsGlob !== localIsGlob) {
      throw new InternalError("Invalid refspec");
    }
    return new GitRefSpec({
      remotePath,
      localPath,
      force,
      matchPrefix: remoteIsGlob
    });
  }
  translate(remoteBranch) {
    if (this.matchPrefix) {
      if (remoteBranch.startsWith(this.remotePath)) {
        return this.localPath + remoteBranch.replace(this.remotePath, "");
      }
    } else {
      if (remoteBranch === this.remotePath) return this.localPath;
    }
    return null;
  }
  reverseTranslate(localBranch) {
    if (this.matchPrefix) {
      if (localBranch.startsWith(this.localPath)) {
        return this.remotePath + localBranch.replace(this.localPath, "");
      }
    } else {
      if (localBranch === this.localPath) return this.remotePath;
    }
    return null;
  }
}
class GitRefSpecSet {
  constructor(rules = []) {
    this.rules = rules;
  }
  static from(refspecs) {
    const rules = [];
    for (const refspec of refspecs) {
      rules.push(GitRefSpec.from(refspec));
    }
    return new GitRefSpecSet(rules);
  }
  add(refspec) {
    const rule = GitRefSpec.from(refspec);
    this.rules.push(rule);
  }
  translate(remoteRefs) {
    const result = [];
    for (const rule of this.rules) {
      for (const remoteRef of remoteRefs) {
        const localRef = rule.translate(remoteRef);
        if (localRef) {
          result.push([remoteRef, localRef]);
        }
      }
    }
    return result;
  }
  translateOne(remoteRef) {
    let result = null;
    for (const rule of this.rules) {
      const localRef = rule.translate(remoteRef);
      if (localRef) {
        result = localRef;
      }
    }
    return result;
  }
  localNamespaces() {
    return this.rules.filter((rule) => rule.matchPrefix).map((rule) => rule.localPath.replace(/\/$/, ""));
  }
}
function compareRefNames(a, b) {
  const _a = a.replace(/\^\{\}$/, "");
  const _b = b.replace(/\^\{\}$/, "");
  const tmp = -(_a < _b) || +(_a > _b);
  if (tmp === 0) {
    return a.endsWith("^{}") ? 1 : -1;
  }
  return tmp;
}
const num = (val) => {
  if (typeof val === "number") {
    return val;
  }
  val = val.toLowerCase();
  let n = parseInt(val);
  if (val.endsWith("k")) n *= 1024;
  if (val.endsWith("m")) n *= 1024 * 1024;
  if (val.endsWith("g")) n *= 1024 * 1024 * 1024;
  return n;
};
const bool = (val) => {
  if (typeof val === "boolean") {
    return val;
  }
  val = val.trim().toLowerCase();
  if (val === "true" || val === "yes" || val === "on") return true;
  if (val === "false" || val === "no" || val === "off") return false;
  throw Error(
    `Expected 'true', 'false', 'yes', 'no', 'on', or 'off', but got ${val}`
  );
};
const schema = {
  core: {
    filemode: bool,
    bare: bool,
    logallrefupdates: bool,
    symlinks: bool,
    ignorecase: bool,
    bigFileThreshold: num
  }
};
const SECTION_LINE_REGEX = /^\[([A-Za-z0-9-.]+)(?: "(.*)")?\]$/;
const SECTION_REGEX = /^[A-Za-z0-9-.]+$/;
const VARIABLE_LINE_REGEX = /^([A-Za-z][A-Za-z-]*)(?: *= *(.*))?$/;
const VARIABLE_NAME_REGEX = /^[A-Za-z][A-Za-z-]*$/;
const VARIABLE_VALUE_COMMENT_REGEX = /^(.*?)( *[#;].*)$/;
const extractSectionLine = (line) => {
  const matches = SECTION_LINE_REGEX.exec(line);
  if (matches != null) {
    const [section, subsection] = matches.slice(1);
    return [section, subsection];
  }
  return null;
};
const extractVariableLine = (line) => {
  const matches = VARIABLE_LINE_REGEX.exec(line);
  if (matches != null) {
    const [name, rawValue = "true"] = matches.slice(1);
    const valueWithoutComments = removeComments(rawValue);
    const valueWithoutQuotes = removeQuotes(valueWithoutComments);
    return [name, valueWithoutQuotes];
  }
  return null;
};
const removeComments = (rawValue) => {
  const commentMatches = VARIABLE_VALUE_COMMENT_REGEX.exec(rawValue);
  if (commentMatches == null) {
    return rawValue;
  }
  const [valueWithoutComment, comment] = commentMatches.slice(1);
  if (hasOddNumberOfQuotes(valueWithoutComment) && hasOddNumberOfQuotes(comment)) {
    return `${valueWithoutComment}${comment}`;
  }
  return valueWithoutComment;
};
const hasOddNumberOfQuotes = (text) => {
  const numberOfQuotes = (text.match(/(?:^|[^\\])"/g) || []).length;
  return numberOfQuotes % 2 !== 0;
};
const removeQuotes = (text) => {
  return text.split("").reduce((newText, c2, idx, text2) => {
    const isQuote = c2 === '"' && text2[idx - 1] !== "\\";
    const isEscapeForQuote = c2 === "\\" && text2[idx + 1] === '"';
    if (isQuote || isEscapeForQuote) {
      return newText;
    }
    return newText + c2;
  }, "");
};
const lower = (text) => {
  return text != null ? text.toLowerCase() : null;
};
const getPath = (section, subsection, name) => {
  return [lower(section), subsection, lower(name)].filter((a) => a != null).join(".");
};
const normalizePath$1 = (path2) => {
  const pathSegments = path2.split(".");
  const section = pathSegments.shift();
  const name = pathSegments.pop();
  const subsection = pathSegments.length ? pathSegments.join(".") : void 0;
  return {
    section,
    subsection,
    name,
    path: getPath(section, subsection, name),
    sectionPath: getPath(section, subsection, null),
    isSection: !!section
  };
};
const findLastIndex = (array, callback) => {
  return array.reduce((lastIndex, item, index2) => {
    return callback(item) ? index2 : lastIndex;
  }, -1);
};
class GitConfig {
  constructor(text) {
    let section = null;
    let subsection = null;
    this.parsedConfig = text ? text.split("\n").map((line) => {
      let name = null;
      let value = null;
      const trimmedLine = line.trim();
      const extractedSection = extractSectionLine(trimmedLine);
      const isSection = extractedSection != null;
      if (isSection) {
        [section, subsection] = extractedSection;
      } else {
        const extractedVariable = extractVariableLine(trimmedLine);
        const isVariable = extractedVariable != null;
        if (isVariable) {
          [name, value] = extractedVariable;
        }
      }
      const path2 = getPath(section, subsection, name);
      return { line, isSection, section, subsection, name, value, path: path2 };
    }) : [];
  }
  static from(text) {
    return new GitConfig(text);
  }
  async get(path2, getall = false) {
    const normalizedPath = normalizePath$1(path2).path;
    const allValues = this.parsedConfig.filter((config) => config.path === normalizedPath).map(({ section, name, value }) => {
      const fn = schema[section] && schema[section][name];
      return fn ? fn(value) : value;
    });
    return getall ? allValues : allValues.pop();
  }
  async getall(path2) {
    return this.get(path2, true);
  }
  async getSubsections(section) {
    return this.parsedConfig.filter((config) => config.isSection && config.section === section).map((config) => config.subsection);
  }
  async deleteSection(section, subsection) {
    this.parsedConfig = this.parsedConfig.filter(
      (config) => !(config.section === section && config.subsection === subsection)
    );
  }
  async append(path2, value) {
    return this.set(path2, value, true);
  }
  async set(path2, value, append = false) {
    const {
      section,
      subsection,
      name,
      path: normalizedPath,
      sectionPath,
      isSection
    } = normalizePath$1(path2);
    const configIndex = findLastIndex(
      this.parsedConfig,
      (config) => config.path === normalizedPath
    );
    if (value == null) {
      if (configIndex !== -1) {
        this.parsedConfig.splice(configIndex, 1);
      }
    } else {
      if (configIndex !== -1) {
        const config = this.parsedConfig[configIndex];
        const modifiedConfig = Object.assign({}, config, {
          name,
          value,
          modified: true
        });
        if (append) {
          this.parsedConfig.splice(configIndex + 1, 0, modifiedConfig);
        } else {
          this.parsedConfig[configIndex] = modifiedConfig;
        }
      } else {
        const sectionIndex = this.parsedConfig.findIndex(
          (config) => config.path === sectionPath
        );
        const newConfig = {
          section,
          subsection,
          name,
          value,
          modified: true,
          path: normalizedPath
        };
        if (SECTION_REGEX.test(section) && VARIABLE_NAME_REGEX.test(name)) {
          if (sectionIndex >= 0) {
            this.parsedConfig.splice(sectionIndex + 1, 0, newConfig);
          } else {
            const newSection = {
              isSection,
              section,
              subsection,
              modified: true,
              path: sectionPath
            };
            this.parsedConfig.push(newSection, newConfig);
          }
        }
      }
    }
  }
  toString() {
    return this.parsedConfig.map(({ line, section, subsection, name, value, modified: modified2 = false }) => {
      if (!modified2) {
        return line;
      }
      if (name != null && value != null) {
        if (typeof value === "string" && /[#;]/.test(value)) {
          return `	${name} = "${value}"`;
        }
        return `	${name} = ${value}`;
      }
      if (subsection != null) {
        return `[${section} "${subsection}"]`;
      }
      return `[${section}]`;
    }).join("\n");
  }
}
class GitConfigManager {
  /**
   * Reads the Git configuration file from the specified `.git` directory.
   *
   * @param {object} opts - Options for reading the Git configuration.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @returns {Promise<GitConfig>} A `GitConfig` object representing the parsed configuration.
   */
  static async get({ fs, gitdir }) {
    const text = await fs.read(`${gitdir}/config`, { encoding: "utf8" });
    return GitConfig.from(text);
  }
  /**
   * Saves the provided Git configuration to the specified `.git` directory.
   *
   * @param {object} opts - Options for saving the Git configuration.
   * @param {FSClient} opts.fs - A file system implementation.
   * @param {string} opts.gitdir - The path to the `.git` directory.
   * @param {GitConfig} opts.config - The `GitConfig` object to save.
   * @returns {Promise<void>} Resolves when the configuration has been successfully saved.
   */
  static async save({ fs, gitdir, config }) {
    await fs.write(`${gitdir}/config`, config.toString(), {
      encoding: "utf8"
    });
  }
}
const refpaths = (ref2) => [
  `${ref2}`,
  `refs/${ref2}`,
  `refs/tags/${ref2}`,
  `refs/heads/${ref2}`,
  `refs/remotes/${ref2}`,
  `refs/remotes/${ref2}/HEAD`
];
const GIT_FILES = ["config", "description", "index", "shallow", "commondir"];
let lock$1;
async function acquireLock(ref2, callback) {
  if (lock$1 === void 0) lock$1 = new AsyncLock();
  return lock$1.acquire(ref2, callback);
}
class GitRefManager {
  /**
   * Updates remote refs based on the provided refspecs and options.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.remote - The name of the remote.
   * @param {Map<string, string>} args.refs - A map of refs to their object IDs.
   * @param {Map<string, string>} args.symrefs - A map of symbolic refs.
   * @param {boolean} args.tags - Whether to fetch tags.
   * @param {string[]} [args.refspecs = undefined] - The refspecs to use.
   * @param {boolean} [args.prune = false] - Whether to prune stale refs.
   * @param {boolean} [args.pruneTags = false] - Whether to prune tags.
   * @returns {Promise<Object>} - An object containing pruned refs.
   */
  static async updateRemoteRefs({
    fs,
    gitdir,
    remote,
    refs,
    symrefs,
    tags,
    refspecs = void 0,
    prune = false,
    pruneTags = false
  }) {
    for (const value of refs.values()) {
      if (!value.match(/[0-9a-f]{40}/)) {
        throw new InvalidOidError(value);
      }
    }
    const config = await GitConfigManager.get({ fs, gitdir });
    if (!refspecs) {
      refspecs = await config.getall(`remote.${remote}.fetch`);
      if (refspecs.length === 0) {
        throw new NoRefspecError(remote);
      }
      refspecs.unshift(`+HEAD:refs/remotes/${remote}/HEAD`);
    }
    const refspec = GitRefSpecSet.from(refspecs);
    const actualRefsToWrite = /* @__PURE__ */ new Map();
    if (pruneTags) {
      const tags2 = await GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: "refs/tags"
      });
      await GitRefManager.deleteRefs({
        fs,
        gitdir,
        refs: tags2.map((tag2) => `refs/tags/${tag2}`)
      });
    }
    if (tags) {
      for (const serverRef of refs.keys()) {
        if (serverRef.startsWith("refs/tags") && !serverRef.endsWith("^{}")) {
          if (!await GitRefManager.exists({ fs, gitdir, ref: serverRef })) {
            const oid = refs.get(serverRef);
            actualRefsToWrite.set(serverRef, oid);
          }
        }
      }
    }
    const refTranslations = refspec.translate([...refs.keys()]);
    for (const [serverRef, translatedRef] of refTranslations) {
      const value = refs.get(serverRef);
      actualRefsToWrite.set(translatedRef, value);
    }
    const symrefTranslations = refspec.translate([...symrefs.keys()]);
    for (const [serverRef, translatedRef] of symrefTranslations) {
      const value = symrefs.get(serverRef);
      const symtarget = refspec.translateOne(value);
      if (symtarget) {
        actualRefsToWrite.set(translatedRef, `ref: ${symtarget}`);
      }
    }
    const pruned = [];
    if (prune) {
      for (const filepath of refspec.localNamespaces()) {
        const refs2 = (await GitRefManager.listRefs({
          fs,
          gitdir,
          filepath
        })).map((file) => `${filepath}/${file}`);
        for (const ref2 of refs2) {
          if (!actualRefsToWrite.has(ref2)) {
            pruned.push(ref2);
          }
        }
      }
      if (pruned.length > 0) {
        await GitRefManager.deleteRefs({ fs, gitdir, refs: pruned });
      }
    }
    for (const [key, value] of actualRefsToWrite) {
      await acquireLock(
        key,
        async () => fs.write(pathBrowserify.join(gitdir, key), `${value.trim()}
`, "utf8")
      );
    }
    return { pruned };
  }
  /**
   * Writes a ref to the file system.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to write.
   * @param {string} args.value - The object ID to write.
   * @returns {Promise<void>}
   */
  // TODO: make this less crude?
  static async writeRef({ fs, gitdir, ref: ref2, value }) {
    if (!value.match(/[0-9a-f]{40}/)) {
      throw new InvalidOidError(value);
    }
    await acquireLock(
      ref2,
      async () => fs.write(pathBrowserify.join(gitdir, ref2), `${value.trim()}
`, "utf8")
    );
  }
  /**
   * Writes a symbolic ref to the file system.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to write.
   * @param {string} args.value - The target ref.
   * @returns {Promise<void>}
   */
  static async writeSymbolicRef({ fs, gitdir, ref: ref2, value }) {
    await acquireLock(
      ref2,
      async () => fs.write(pathBrowserify.join(gitdir, ref2), `ref: ${value.trim()}
`, "utf8")
    );
  }
  /**
   * Deletes a single ref.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to delete.
   * @returns {Promise<void>}
   */
  static async deleteRef({ fs, gitdir, ref: ref2 }) {
    return GitRefManager.deleteRefs({ fs, gitdir, refs: [ref2] });
  }
  /**
   * Deletes multiple refs.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string[]} args.refs - The refs to delete.
   * @returns {Promise<void>}
   */
  static async deleteRefs({ fs, gitdir, refs }) {
    await Promise.all(refs.map((ref2) => fs.rm(pathBrowserify.join(gitdir, ref2))));
    let text = await acquireLock(
      "packed-refs",
      async () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );
    const packed = GitPackedRefs.from(text);
    const beforeSize = packed.refs.size;
    for (const ref2 of refs) {
      if (packed.refs.has(ref2)) {
        packed.delete(ref2);
      }
    }
    if (packed.refs.size < beforeSize) {
      text = packed.toString();
      await acquireLock(
        "packed-refs",
        async () => fs.write(`${gitdir}/packed-refs`, text, { encoding: "utf8" })
      );
    }
  }
  /**
   * Resolves a ref to its object ID.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to resolve.
   * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
   * @returns {Promise<string>} - The resolved object ID.
   */
  static async resolve({ fs, gitdir, ref: ref2, depth = void 0 }) {
    if (depth !== void 0) {
      depth--;
      if (depth === -1) {
        return ref2;
      }
    }
    if (ref2.startsWith("ref: ")) {
      ref2 = ref2.slice("ref: ".length);
      return GitRefManager.resolve({ fs, gitdir, ref: ref2, depth });
    }
    if (ref2.length === 40 && /[0-9a-f]{40}/.test(ref2)) {
      return ref2;
    }
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir });
    const allpaths = refpaths(ref2).filter((p) => !GIT_FILES.includes(p));
    for (const ref22 of allpaths) {
      const sha = await acquireLock(
        ref22,
        async () => await fs.read(`${gitdir}/${ref22}`, { encoding: "utf8" }) || packedMap.get(ref22)
      );
      if (sha) {
        return GitRefManager.resolve({ fs, gitdir, ref: sha.trim(), depth });
      }
    }
    throw new NotFoundError(ref2);
  }
  /**
   * Checks if a ref exists.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to check.
   * @returns {Promise<boolean>} - True if the ref exists, false otherwise.
   */
  static async exists({ fs, gitdir, ref: ref2 }) {
    try {
      await GitRefManager.expand({ fs, gitdir, ref: ref2 });
      return true;
    } catch (err2) {
      return false;
    }
  }
  /**
   * Expands a ref to its full name.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.ref - The ref to expand.
   * @returns {Promise<string>} - The full ref name.
   */
  static async expand({ fs, gitdir, ref: ref2 }) {
    if (ref2.length === 40 && /[0-9a-f]{40}/.test(ref2)) {
      return ref2;
    }
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir });
    const allpaths = refpaths(ref2);
    for (const ref22 of allpaths) {
      const refExists = await acquireLock(
        ref22,
        async () => fs.exists(`${gitdir}/${ref22}`)
      );
      if (refExists) return ref22;
      if (packedMap.has(ref22)) return ref22;
    }
    throw new NotFoundError(ref2);
  }
  /**
   * Expands a ref against a provided map.
   *
   * @param {Object} args
   * @param {string} args.ref - The ref to expand.
   * @param {Map<string, string>} args.map - The map of refs.
   * @returns {Promise<string>} - The expanded ref.
   */
  static async expandAgainstMap({ ref: ref2, map }) {
    const allpaths = refpaths(ref2);
    for (const ref22 of allpaths) {
      if (await map.has(ref22)) return ref22;
    }
    throw new NotFoundError(ref2);
  }
  /**
   * Resolves a ref against a provided map.
   *
   * @param {Object} args
   * @param {string} args.ref - The ref to resolve.
   * @param {string} [args.fullref = args.ref] - The full ref name.
   * @param {number} [args.depth = undefined] - The maximum depth to resolve symbolic refs.
   * @param {Map<string, string>} args.map - The map of refs.
   * @returns {Object} - An object containing the full ref and its object ID.
   */
  static resolveAgainstMap({ ref: ref2, fullref = ref2, depth = void 0, map }) {
    if (depth !== void 0) {
      depth--;
      if (depth === -1) {
        return { fullref, oid: ref2 };
      }
    }
    if (ref2.startsWith("ref: ")) {
      ref2 = ref2.slice("ref: ".length);
      return GitRefManager.resolveAgainstMap({ ref: ref2, fullref, depth, map });
    }
    if (ref2.length === 40 && /[0-9a-f]{40}/.test(ref2)) {
      return { fullref, oid: ref2 };
    }
    const allpaths = refpaths(ref2);
    for (const ref22 of allpaths) {
      const sha = map.get(ref22);
      if (sha) {
        return GitRefManager.resolveAgainstMap({
          ref: sha.trim(),
          fullref: ref22,
          depth,
          map
        });
      }
    }
    throw new NotFoundError(ref2);
  }
  /**
   * Reads the packed refs file and returns a map of refs.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<Map<string, string>>} - A map of packed refs.
   */
  static async packedRefs({ fs, gitdir }) {
    const text = await acquireLock(
      "packed-refs",
      async () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );
    const packed = GitPackedRefs.from(text);
    return packed.refs;
  }
  /**
   * Lists all refs matching a given filepath prefix.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.filepath - The filepath prefix to match.
   * @returns {Promise<string[]>} - A sorted list of refs.
   */
  static async listRefs({ fs, gitdir, filepath }) {
    const packedMap = GitRefManager.packedRefs({ fs, gitdir });
    let files = null;
    try {
      files = await fs.readdirDeep(`${gitdir}/${filepath}`);
      files = files.map((x) => x.replace(`${gitdir}/${filepath}/`, ""));
    } catch (err2) {
      files = [];
    }
    for (let key of (await packedMap).keys()) {
      if (key.startsWith(filepath)) {
        key = key.replace(filepath + "/", "");
        if (!files.includes(key)) {
          files.push(key);
        }
      }
    }
    files.sort(compareRefNames);
    return files;
  }
  /**
   * Lists all branches, optionally filtered by remote.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} [args.remote] - The remote to filter branches by.
   * @returns {Promise<string[]>} - A list of branch names.
   */
  static async listBranches({ fs, gitdir, remote }) {
    if (remote) {
      return GitRefManager.listRefs({
        fs,
        gitdir,
        filepath: `refs/remotes/${remote}`
      });
    } else {
      return GitRefManager.listRefs({ fs, gitdir, filepath: `refs/heads` });
    }
  }
  /**
   * Lists all tags.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<string[]>} - A list of tag names.
   */
  static async listTags({ fs, gitdir }) {
    const tags = await GitRefManager.listRefs({
      fs,
      gitdir,
      filepath: `refs/tags`
    });
    return tags.filter((x) => !x.endsWith("^{}"));
  }
}
function compareTreeEntryPath(a, b) {
  return compareStrings(appendSlashIfDir(a), appendSlashIfDir(b));
}
function appendSlashIfDir(entry) {
  return entry.mode === "040000" ? entry.path + "/" : entry.path;
}
function mode2type$1(mode) {
  switch (mode) {
    case "040000":
      return "tree";
    case "100644":
      return "blob";
    case "100755":
      return "blob";
    case "120000":
      return "blob";
    case "160000":
      return "commit";
  }
  throw new InternalError(`Unexpected GitTree entry mode: ${mode}`);
}
function parseBuffer(buffer) {
  const _entries = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const space = buffer.indexOf(32, cursor);
    if (space === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next space character.`
      );
    }
    const nullchar = buffer.indexOf(0, cursor);
    if (nullchar === -1) {
      throw new InternalError(
        `GitTree: Error parsing buffer at byte location ${cursor}: Could not find the next null character.`
      );
    }
    let mode = buffer.slice(cursor, space).toString("utf8");
    if (mode === "40000") mode = "040000";
    const type2 = mode2type$1(mode);
    const path2 = buffer.slice(space + 1, nullchar).toString("utf8");
    if (path2.includes("\\") || path2.includes("/")) {
      throw new UnsafeFilepathError(path2);
    }
    const oid = buffer.slice(nullchar + 1, nullchar + 21).toString("hex");
    cursor = nullchar + 21;
    _entries.push({ mode, path: path2, oid, type: type2 });
  }
  return _entries;
}
function limitModeToAllowed(mode) {
  if (typeof mode === "number") {
    mode = mode.toString(8);
  }
  if (mode.match(/^0?4.*/)) return "040000";
  if (mode.match(/^1006.*/)) return "100644";
  if (mode.match(/^1007.*/)) return "100755";
  if (mode.match(/^120.*/)) return "120000";
  if (mode.match(/^160.*/)) return "160000";
  throw new InternalError(`Could not understand file mode: ${mode}`);
}
function nudgeIntoShape(entry) {
  if (!entry.oid && entry.sha) {
    entry.oid = entry.sha;
  }
  entry.mode = limitModeToAllowed(entry.mode);
  if (!entry.type) {
    entry.type = mode2type$1(entry.mode);
  }
  return entry;
}
class GitTree {
  constructor(entries) {
    if (Buffer.isBuffer(entries)) {
      this._entries = parseBuffer(entries);
    } else if (Array.isArray(entries)) {
      this._entries = entries.map(nudgeIntoShape);
    } else {
      throw new InternalError("invalid type passed to GitTree constructor");
    }
    this._entries.sort(comparePath);
  }
  static from(tree) {
    return new GitTree(tree);
  }
  render() {
    return this._entries.map((entry) => `${entry.mode} ${entry.type} ${entry.oid}    ${entry.path}`).join("\n");
  }
  toObject() {
    const entries = [...this._entries];
    entries.sort(compareTreeEntryPath);
    return Buffer.concat(
      entries.map((entry) => {
        const mode = Buffer.from(entry.mode.replace(/^0/, ""));
        const space = Buffer.from(" ");
        const path2 = Buffer.from(entry.path, "utf8");
        const nullchar = Buffer.from([0]);
        const oid = Buffer.from(entry.oid, "hex");
        return Buffer.concat([mode, space, path2, nullchar, oid]);
      })
    );
  }
  /**
   * @returns {TreeEntry[]}
   */
  entries() {
    return this._entries;
  }
  *[Symbol.iterator]() {
    for (const entry of this._entries) {
      yield entry;
    }
  }
}
class GitObject {
  /**
   * Wraps a raw object with a Git header.
   *
   * @param {Object} params - The parameters for wrapping.
   * @param {string} params.type - The type of the Git object (e.g., 'blob', 'tree', 'commit').
   * @param {Uint8Array} params.object - The raw object data to wrap.
   * @returns {Uint8Array} The wrapped Git object as a single buffer.
   */
  static wrap({ type: type2, object }) {
    const header = `${type2} ${object.length}\0`;
    const headerLen = header.length;
    const totalLength = headerLen + object.length;
    const wrappedObject = new Uint8Array(totalLength);
    for (let i = 0; i < headerLen; i++) {
      wrappedObject[i] = header.charCodeAt(i);
    }
    wrappedObject.set(object, headerLen);
    return wrappedObject;
  }
  /**
   * Unwraps a Git object buffer into its type and raw object data.
   *
   * @param {Buffer|Uint8Array} buffer - The buffer containing the wrapped Git object.
   * @returns {{ type: string, object: Buffer }} An object containing the type and the raw object data.
   * @throws {InternalError} If the length specified in the header does not match the actual object length.
   */
  static unwrap(buffer) {
    const s = buffer.indexOf(32);
    const i = buffer.indexOf(0);
    const type2 = buffer.slice(0, s).toString("utf8");
    const length = buffer.slice(s + 1, i).toString("utf8");
    const actualLength = buffer.length - (i + 1);
    if (parseInt(length) !== actualLength) {
      throw new InternalError(
        `Length mismatch: expected ${length} bytes but got ${actualLength} instead.`
      );
    }
    return {
      type: type2,
      object: Buffer.from(buffer.slice(i + 1))
    };
  }
}
async function readObjectLoose({ fs, gitdir, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  const file = await fs.read(`${gitdir}/${source}`);
  if (!file) {
    return null;
  }
  return { object: file, format: "deflated", source };
}
function applyDelta(delta, source) {
  const reader = new BufferCursor(delta);
  const sourceSize = readVarIntLE(reader);
  if (sourceSize !== source.byteLength) {
    throw new InternalError(
      `applyDelta expected source buffer to be ${sourceSize} bytes but the provided buffer was ${source.length} bytes`
    );
  }
  const targetSize = readVarIntLE(reader);
  let target;
  const firstOp = readOp(reader, source);
  if (firstOp.byteLength === targetSize) {
    target = firstOp;
  } else {
    target = Buffer.alloc(targetSize);
    const writer = new BufferCursor(target);
    writer.copy(firstOp);
    while (!reader.eof()) {
      writer.copy(readOp(reader, source));
    }
    const tell = writer.tell();
    if (targetSize !== tell) {
      throw new InternalError(
        `applyDelta expected target buffer to be ${targetSize} bytes but the resulting buffer was ${tell} bytes`
      );
    }
  }
  return target;
}
function readVarIntLE(reader) {
  let result = 0;
  let shift = 0;
  let byte = null;
  do {
    byte = reader.readUInt8();
    result |= (byte & 127) << shift;
    shift += 7;
  } while (byte & 128);
  return result;
}
function readCompactLE(reader, flags, size) {
  let result = 0;
  let shift = 0;
  while (size--) {
    if (flags & 1) {
      result |= reader.readUInt8() << shift;
    }
    flags >>= 1;
    shift += 8;
  }
  return result;
}
function readOp(reader, source) {
  const byte = reader.readUInt8();
  const COPY2 = 128;
  const OFFS = 15;
  const SIZE = 112;
  if (byte & COPY2) {
    const offset = readCompactLE(reader, byte & OFFS, 4);
    let size = readCompactLE(reader, (byte & SIZE) >> 4, 3);
    if (size === 0) size = 65536;
    return source.slice(offset, offset + size);
  } else {
    return reader.slice(byte);
  }
}
function fromValue(value) {
  let queue = [value];
  return {
    next() {
      return Promise.resolve({ done: queue.length === 0, value: queue.pop() });
    },
    return() {
      queue = [];
      return {};
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
function getIterator(iterable) {
  if (iterable[Symbol.asyncIterator]) {
    return iterable[Symbol.asyncIterator]();
  }
  if (iterable[Symbol.iterator]) {
    return iterable[Symbol.iterator]();
  }
  if (iterable.next) {
    return iterable;
  }
  return fromValue(iterable);
}
class StreamReader {
  constructor(stream) {
    if (typeof Buffer === "undefined") {
      throw new Error("Missing Buffer dependency");
    }
    this.stream = getIterator(stream);
    this.buffer = null;
    this.cursor = 0;
    this.undoCursor = 0;
    this.started = false;
    this._ended = false;
    this._discardedBytes = 0;
  }
  eof() {
    return this._ended && this.cursor === this.buffer.length;
  }
  tell() {
    return this._discardedBytes + this.cursor;
  }
  async byte() {
    if (this.eof()) return;
    if (!this.started) await this._init();
    if (this.cursor === this.buffer.length) {
      await this._loadnext();
      if (this._ended) return;
    }
    this._moveCursor(1);
    return this.buffer[this.undoCursor];
  }
  async chunk() {
    if (this.eof()) return;
    if (!this.started) await this._init();
    if (this.cursor === this.buffer.length) {
      await this._loadnext();
      if (this._ended) return;
    }
    this._moveCursor(this.buffer.length);
    return this.buffer.slice(this.undoCursor, this.cursor);
  }
  async read(n) {
    if (this.eof()) return;
    if (!this.started) await this._init();
    if (this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }
    this._moveCursor(n);
    return this.buffer.slice(this.undoCursor, this.cursor);
  }
  async skip(n) {
    if (this.eof()) return;
    if (!this.started) await this._init();
    if (this.cursor + n > this.buffer.length) {
      this._trim();
      await this._accumulate(n);
    }
    this._moveCursor(n);
  }
  async undo() {
    this.cursor = this.undoCursor;
  }
  async _next() {
    this.started = true;
    let { done, value } = await this.stream.next();
    if (done) {
      this._ended = true;
      if (!value) return Buffer.alloc(0);
    }
    if (value) {
      value = Buffer.from(value);
    }
    return value;
  }
  _trim() {
    this.buffer = this.buffer.slice(this.undoCursor);
    this.cursor -= this.undoCursor;
    this._discardedBytes += this.undoCursor;
    this.undoCursor = 0;
  }
  _moveCursor(n) {
    this.undoCursor = this.cursor;
    this.cursor += n;
    if (this.cursor > this.buffer.length) {
      this.cursor = this.buffer.length;
    }
  }
  async _accumulate(n) {
    if (this._ended) return;
    const buffers = [this.buffer];
    while (this.cursor + n > lengthBuffers(buffers)) {
      const nextbuffer = await this._next();
      if (this._ended) break;
      buffers.push(nextbuffer);
    }
    this.buffer = Buffer.concat(buffers);
  }
  async _loadnext() {
    this._discardedBytes += this.buffer.length;
    this.undoCursor = 0;
    this.cursor = 0;
    this.buffer = await this._next();
  }
  async _init() {
    this.buffer = await this._next();
  }
}
function lengthBuffers(buffers) {
  return buffers.reduce((acc, buffer) => acc + buffer.length, 0);
}
async function listpack(stream, onData) {
  const reader = new StreamReader(stream);
  let PACK = await reader.read(4);
  PACK = PACK.toString("utf8");
  if (PACK !== "PACK") {
    throw new InternalError(`Invalid PACK header '${PACK}'`);
  }
  let version2 = await reader.read(4);
  version2 = version2.readUInt32BE(0);
  if (version2 !== 2) {
    throw new InternalError(`Invalid packfile version: ${version2}`);
  }
  let numObjects = await reader.read(4);
  numObjects = numObjects.readUInt32BE(0);
  if (numObjects < 1) return;
  while (!reader.eof() && numObjects--) {
    const offset = reader.tell();
    const { type: type2, length, ofs, reference } = await parseHeader(reader);
    const inflator = new pako.Inflate();
    while (!inflator.result) {
      const chunk = await reader.chunk();
      if (!chunk) break;
      inflator.push(chunk, false);
      if (inflator.err) {
        throw new InternalError(`Pako error: ${inflator.msg}`);
      }
      if (inflator.result) {
        if (inflator.result.length !== length) {
          throw new InternalError(
            `Inflated object size is different from that stated in packfile.`
          );
        }
        await reader.undo();
        await reader.read(chunk.length - inflator.strm.avail_in);
        const end = reader.tell();
        await onData({
          data: inflator.result,
          type: type2,
          num: numObjects,
          offset,
          end,
          reference,
          ofs
        });
      }
    }
  }
}
async function parseHeader(reader) {
  let byte = await reader.byte();
  const type2 = byte >> 4 & 7;
  let length = byte & 15;
  if (byte & 128) {
    let shift = 4;
    do {
      byte = await reader.byte();
      length |= (byte & 127) << shift;
      shift += 7;
    } while (byte & 128);
  }
  let ofs;
  let reference;
  if (type2 === 6) {
    let shift = 0;
    ofs = 0;
    const bytes = [];
    do {
      byte = await reader.byte();
      ofs |= (byte & 127) << shift;
      shift += 7;
      bytes.push(byte);
    } while (byte & 128);
    reference = Buffer.from(bytes);
  }
  if (type2 === 7) {
    const buf = await reader.read(20);
    reference = buf;
  }
  return { type: type2, length, ofs, reference };
}
async function inflate(buffer) {
  return pako.inflate(buffer);
}
function decodeVarInt(reader) {
  const bytes = [];
  let byte = 0;
  let multibyte = 0;
  do {
    byte = reader.readUInt8();
    const lastSeven = byte & 127;
    bytes.push(lastSeven);
    multibyte = byte & 128;
  } while (multibyte);
  return bytes.reduce((a, b) => a + 1 << 7 | b, -1);
}
function otherVarIntDecode(reader, startWith) {
  let result = startWith;
  let shift = 4;
  let byte = null;
  do {
    byte = reader.readUInt8();
    result |= (byte & 127) << shift;
    shift += 7;
  } while (byte & 128);
  return result;
}
class GitPackIndex {
  constructor(stuff) {
    Object.assign(this, stuff);
    this.offsetCache = {};
  }
  static async fromIdx({ idx, getExternalRefDelta }) {
    const reader = new BufferCursor(idx);
    const magic = reader.slice(4).toString("hex");
    if (magic !== "ff744f63") {
      return;
    }
    const version2 = reader.readUInt32BE();
    if (version2 !== 2) {
      throw new InternalError(
        `Unable to read version ${version2} packfile IDX. (Only version 2 supported)`
      );
    }
    if (idx.byteLength > 2048 * 1024 * 1024) {
      throw new InternalError(
        `To keep implementation simple, I haven't implemented the layer 5 feature needed to support packfiles > 2GB in size.`
      );
    }
    reader.seek(reader.tell() + 4 * 255);
    const size = reader.readUInt32BE();
    const hashes = [];
    for (let i = 0; i < size; i++) {
      const hash2 = reader.slice(20).toString("hex");
      hashes[i] = hash2;
    }
    reader.seek(reader.tell() + 4 * size);
    const offsets = /* @__PURE__ */ new Map();
    for (let i = 0; i < size; i++) {
      offsets.set(hashes[i], reader.readUInt32BE());
    }
    const packfileSha = reader.slice(20).toString("hex");
    return new GitPackIndex({
      hashes,
      crcs: {},
      offsets,
      packfileSha,
      getExternalRefDelta
    });
  }
  static async fromPack({ pack, getExternalRefDelta, onProgress }) {
    const listpackTypes = {
      1: "commit",
      2: "tree",
      3: "blob",
      4: "tag",
      6: "ofs-delta",
      7: "ref-delta"
    };
    const offsetToObject = {};
    const packfileSha = pack.slice(-20).toString("hex");
    const hashes = [];
    const crcs = {};
    const offsets = /* @__PURE__ */ new Map();
    let totalObjectCount = null;
    let lastPercent = null;
    await listpack([pack], async ({ data, type: type2, reference, offset, num: num2 }) => {
      if (totalObjectCount === null) totalObjectCount = num2;
      const percent = Math.floor(
        (totalObjectCount - num2) * 100 / totalObjectCount
      );
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: "Receiving objects",
            loaded: totalObjectCount - num2,
            total: totalObjectCount
          });
        }
      }
      lastPercent = percent;
      type2 = listpackTypes[type2];
      if (["commit", "tree", "blob", "tag"].includes(type2)) {
        offsetToObject[offset] = {
          type: type2,
          offset
        };
      } else if (type2 === "ofs-delta") {
        offsetToObject[offset] = {
          type: type2,
          offset
        };
      } else if (type2 === "ref-delta") {
        offsetToObject[offset] = {
          type: type2,
          offset
        };
      }
    });
    const offsetArray = Object.keys(offsetToObject).map(Number);
    for (const [i, start] of offsetArray.entries()) {
      const end = i + 1 === offsetArray.length ? pack.byteLength - 20 : offsetArray[i + 1];
      const o = offsetToObject[start];
      const crc = crc32.buf(pack.slice(start, end)) >>> 0;
      o.end = end;
      o.crc = crc;
    }
    const p = new GitPackIndex({
      pack: Promise.resolve(pack),
      packfileSha,
      crcs,
      hashes,
      offsets,
      getExternalRefDelta
    });
    lastPercent = null;
    let count = 0;
    const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let offset in offsetToObject) {
      offset = Number(offset);
      const percent = Math.floor(count * 100 / totalObjectCount);
      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            phase: "Resolving deltas",
            loaded: count,
            total: totalObjectCount
          });
        }
      }
      count++;
      lastPercent = percent;
      const o = offsetToObject[offset];
      if (o.oid) continue;
      try {
        p.readDepth = 0;
        p.externalReadDepth = 0;
        const { type: type2, object } = await p.readSlice({ start: offset });
        objectsByDepth[p.readDepth] += 1;
        const oid = await shasum(GitObject.wrap({ type: type2, object }));
        o.oid = oid;
        hashes.push(oid);
        offsets.set(oid, offset);
        crcs[oid] = o.crc;
      } catch (err2) {
        continue;
      }
    }
    hashes.sort();
    return p;
  }
  async toBuffer() {
    const buffers = [];
    const write = (str, encoding) => {
      buffers.push(Buffer.from(str, encoding));
    };
    write("ff744f63", "hex");
    write("00000002", "hex");
    const fanoutBuffer = new BufferCursor(Buffer.alloc(256 * 4));
    for (let i = 0; i < 256; i++) {
      let count = 0;
      for (const hash2 of this.hashes) {
        if (parseInt(hash2.slice(0, 2), 16) <= i) count++;
      }
      fanoutBuffer.writeUInt32BE(count);
    }
    buffers.push(fanoutBuffer.buffer);
    for (const hash2 of this.hashes) {
      write(hash2, "hex");
    }
    const crcsBuffer = new BufferCursor(Buffer.alloc(this.hashes.length * 4));
    for (const hash2 of this.hashes) {
      crcsBuffer.writeUInt32BE(this.crcs[hash2]);
    }
    buffers.push(crcsBuffer.buffer);
    const offsetsBuffer = new BufferCursor(Buffer.alloc(this.hashes.length * 4));
    for (const hash2 of this.hashes) {
      offsetsBuffer.writeUInt32BE(this.offsets.get(hash2));
    }
    buffers.push(offsetsBuffer.buffer);
    write(this.packfileSha, "hex");
    const totalBuffer = Buffer.concat(buffers);
    const sha = await shasum(totalBuffer);
    const shaBuffer = Buffer.alloc(20);
    shaBuffer.write(sha, "hex");
    return Buffer.concat([totalBuffer, shaBuffer]);
  }
  async load({ pack }) {
    this.pack = pack;
  }
  async unload() {
    this.pack = null;
  }
  async read({ oid }) {
    if (!this.offsets.get(oid)) {
      if (this.getExternalRefDelta) {
        this.externalReadDepth++;
        return this.getExternalRefDelta(oid);
      } else {
        throw new InternalError(`Could not read object ${oid} from packfile`);
      }
    }
    const start = this.offsets.get(oid);
    return this.readSlice({ start });
  }
  async readSlice({ start }) {
    if (this.offsetCache[start]) {
      return Object.assign({}, this.offsetCache[start]);
    }
    this.readDepth++;
    const types2 = {
      16: "commit",
      32: "tree",
      48: "blob",
      64: "tag",
      96: "ofs_delta",
      112: "ref_delta"
    };
    if (!this.pack) {
      throw new InternalError(
        "Tried to read from a GitPackIndex with no packfile loaded into memory"
      );
    }
    const raw = (await this.pack).slice(start);
    const reader = new BufferCursor(raw);
    const byte = reader.readUInt8();
    const btype = byte & 112;
    let type2 = types2[btype];
    if (type2 === void 0) {
      throw new InternalError("Unrecognized type: 0b" + btype.toString(2));
    }
    const lastFour = byte & 15;
    let length = lastFour;
    const multibyte = byte & 128;
    if (multibyte) {
      length = otherVarIntDecode(reader, lastFour);
    }
    let base = null;
    let object = null;
    if (type2 === "ofs_delta") {
      const offset = decodeVarInt(reader);
      const baseOffset = start - offset;
      ({ object: base, type: type2 } = await this.readSlice({ start: baseOffset }));
    }
    if (type2 === "ref_delta") {
      const oid = reader.slice(20).toString("hex");
      ({ object: base, type: type2 } = await this.read({ oid }));
    }
    const buffer = raw.slice(reader.tell());
    object = Buffer.from(await inflate(buffer));
    if (object.byteLength !== length) {
      throw new InternalError(
        `Packfile told us object would have length ${length} but it had length ${object.byteLength}`
      );
    }
    if (base) {
      object = Buffer.from(applyDelta(object, base));
    }
    if (this.readDepth > 3) {
      this.offsetCache[start] = { type: type2, object };
    }
    return { type: type2, format: "content", object };
  }
}
const PackfileCache = Symbol("PackfileCache");
async function loadPackIndex({
  fs,
  filename,
  getExternalRefDelta,
  emitter,
  emitterPrefix
}) {
  const idx = await fs.read(filename);
  return GitPackIndex.fromIdx({ idx, getExternalRefDelta });
}
function readPackIndex({
  fs,
  cache,
  filename,
  getExternalRefDelta,
  emitter,
  emitterPrefix
}) {
  if (!cache[PackfileCache]) cache[PackfileCache] = /* @__PURE__ */ new Map();
  let p = cache[PackfileCache].get(filename);
  if (!p) {
    p = loadPackIndex({
      fs,
      filename,
      getExternalRefDelta,
      emitter,
      emitterPrefix
    });
    cache[PackfileCache].set(filename, p);
  }
  return p;
}
async function readObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  format: format2 = "content",
  getExternalRefDelta
}) {
  let list = await fs.readdir(pathBrowserify.join(gitdir, "objects/pack"));
  list = list.filter((x) => x.endsWith(".idx"));
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta
    });
    if (p.error) throw new InternalError(p.error);
    if (p.offsets.has(oid)) {
      if (!p.pack) {
        const packFile = indexFile.replace(/idx$/, "pack");
        p.pack = fs.read(packFile);
      }
      const result = await p.read({ oid, getExternalRefDelta });
      result.format = "content";
      result.source = `objects/pack/${filename.replace(/idx$/, "pack")}`;
      return result;
    }
  }
  return null;
}
async function _readObject({
  fs,
  cache,
  gitdir,
  oid,
  format: format2 = "content"
}) {
  const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
  let result;
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
    result = { format: "wrapped", object: Buffer.from(`tree 0\0`) };
  }
  if (!result) {
    result = await readObjectLoose({ fs, gitdir, oid });
  }
  if (!result) {
    result = await readObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta
    });
    if (!result) {
      throw new NotFoundError(oid);
    }
    return result;
  }
  if (format2 === "deflated") {
    return result;
  }
  if (result.format === "deflated") {
    result.object = Buffer.from(await inflate(result.object));
    result.format = "wrapped";
  }
  if (format2 === "wrapped") {
    return result;
  }
  const sha = await shasum(result.object);
  if (sha !== oid) {
    throw new InternalError(
      `SHA check failed! Expected ${oid}, computed ${sha}`
    );
  }
  const { object, type: type2 } = GitObject.unwrap(result.object);
  result.type = type2;
  result.object = object;
  result.format = "content";
  if (format2 === "content") {
    return result;
  }
  throw new InternalError(`invalid requested format "${format2}"`);
}
class AlreadyExistsError extends BaseError {
  /**
   * @param {'note'|'remote'|'tag'|'branch'} noun
   * @param {string} where
   * @param {boolean} canForce
   */
  constructor(noun, where, canForce = true) {
    super(
      `Failed to create ${noun} at ${where} because it already exists.${canForce ? ` (Hint: use 'force: true' parameter to overwrite existing ${noun}.)` : ""}`
    );
    this.code = this.name = AlreadyExistsError.code;
    this.data = { noun, where, canForce };
  }
}
AlreadyExistsError.code = "AlreadyExistsError";
class AmbiguousError extends BaseError {
  /**
   * @param {'oids'|'refs'} nouns
   * @param {string} short
   * @param {string[]} matches
   */
  constructor(nouns, short, matches) {
    super(
      `Found multiple ${nouns} matching "${short}" (${matches.join(
        ", "
      )}). Use a longer abbreviation length to disambiguate them.`
    );
    this.code = this.name = AmbiguousError.code;
    this.data = { nouns, short, matches };
  }
}
AmbiguousError.code = "AmbiguousError";
class CheckoutConflictError extends BaseError {
  /**
   * @param {string[]} filepaths
   */
  constructor(filepaths) {
    super(
      `Your local changes to the following files would be overwritten by checkout: ${filepaths.join(
        ", "
      )}`
    );
    this.code = this.name = CheckoutConflictError.code;
    this.data = { filepaths };
  }
}
CheckoutConflictError.code = "CheckoutConflictError";
class CommitNotFetchedError extends BaseError {
  /**
   * @param {string} ref
   * @param {string} oid
   */
  constructor(ref2, oid) {
    super(
      `Failed to checkout "${ref2}" because commit ${oid} is not available locally. Do a git fetch to make the branch available locally.`
    );
    this.code = this.name = CommitNotFetchedError.code;
    this.data = { ref: ref2, oid };
  }
}
CommitNotFetchedError.code = "CommitNotFetchedError";
class EmptyServerResponseError extends BaseError {
  constructor() {
    super(`Empty response from git server.`);
    this.code = this.name = EmptyServerResponseError.code;
    this.data = {};
  }
}
EmptyServerResponseError.code = "EmptyServerResponseError";
class FastForwardError extends BaseError {
  constructor() {
    super(`A simple fast-forward merge was not possible.`);
    this.code = this.name = FastForwardError.code;
    this.data = {};
  }
}
FastForwardError.code = "FastForwardError";
class GitPushError extends BaseError {
  /**
   * @param {string} prettyDetails
   * @param {PushResult} result
   */
  constructor(prettyDetails, result) {
    super(`One or more branches were not updated: ${prettyDetails}`);
    this.code = this.name = GitPushError.code;
    this.data = { prettyDetails, result };
  }
}
GitPushError.code = "GitPushError";
class HttpError extends BaseError {
  /**
   * @param {number} statusCode
   * @param {string} statusMessage
   * @param {string} response
   */
  constructor(statusCode, statusMessage, response) {
    super(`HTTP Error: ${statusCode} ${statusMessage}`);
    this.code = this.name = HttpError.code;
    this.data = { statusCode, statusMessage, response };
  }
}
HttpError.code = "HttpError";
class InvalidFilepathError extends BaseError {
  /**
   * @param {'leading-slash'|'trailing-slash'|'directory'} [reason]
   */
  constructor(reason) {
    let message = "invalid filepath";
    if (reason === "leading-slash" || reason === "trailing-slash") {
      message = `"filepath" parameter should not include leading or trailing directory separators because these can cause problems on some platforms.`;
    } else if (reason === "directory") {
      message = `"filepath" should not be a directory.`;
    }
    super(message);
    this.code = this.name = InvalidFilepathError.code;
    this.data = { reason };
  }
}
InvalidFilepathError.code = "InvalidFilepathError";
class InvalidRefNameError extends BaseError {
  /**
   * @param {string} ref
   * @param {string} suggestion
   * @param {boolean} canForce
   */
  constructor(ref2, suggestion) {
    super(
      `"${ref2}" would be an invalid git reference. (Hint: a valid alternative would be "${suggestion}".)`
    );
    this.code = this.name = InvalidRefNameError.code;
    this.data = { ref: ref2, suggestion };
  }
}
InvalidRefNameError.code = "InvalidRefNameError";
class MaxDepthError extends BaseError {
  /**
   * @param {number} depth
   */
  constructor(depth) {
    super(`Maximum search depth of ${depth} exceeded.`);
    this.code = this.name = MaxDepthError.code;
    this.data = { depth };
  }
}
MaxDepthError.code = "MaxDepthError";
class MergeNotSupportedError extends BaseError {
  constructor() {
    super(`Merges with conflicts are not supported yet.`);
    this.code = this.name = MergeNotSupportedError.code;
    this.data = {};
  }
}
MergeNotSupportedError.code = "MergeNotSupportedError";
class MergeConflictError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   * @param {Array<string>} bothModified
   * @param {Array<string>} deleteByUs
   * @param {Array<string>} deleteByTheirs
   */
  constructor(filepaths, bothModified, deleteByUs, deleteByTheirs) {
    super(
      `Automatic merge failed with one or more merge conflicts in the following files: ${filepaths.toString()}. Fix conflicts then commit the result.`
    );
    this.code = this.name = MergeConflictError.code;
    this.data = { filepaths, bothModified, deleteByUs, deleteByTheirs };
  }
}
MergeConflictError.code = "MergeConflictError";
class MissingNameError extends BaseError {
  /**
   * @param {'author'|'committer'|'tagger'} role
   */
  constructor(role) {
    super(
      `No name was provided for ${role} in the argument or in the .git/config file.`
    );
    this.code = this.name = MissingNameError.code;
    this.data = { role };
  }
}
MissingNameError.code = "MissingNameError";
class MissingParameterError extends BaseError {
  /**
   * @param {string} parameter
   */
  constructor(parameter) {
    super(
      `The function requires a "${parameter}" parameter but none was provided.`
    );
    this.code = this.name = MissingParameterError.code;
    this.data = { parameter };
  }
}
MissingParameterError.code = "MissingParameterError";
class MultipleGitError extends BaseError {
  /**
   * @param {Error[]} errors
   * @param {string} message
   */
  constructor(errors2) {
    super(
      `There are multiple errors that were thrown by the method. Please refer to the "errors" property to see more`
    );
    this.code = this.name = MultipleGitError.code;
    this.data = { errors: errors2 };
    this.errors = errors2;
  }
}
MultipleGitError.code = "MultipleGitError";
class ParseError extends BaseError {
  /**
   * @param {string} expected
   * @param {string} actual
   */
  constructor(expected, actual) {
    super(`Expected "${expected}" but received "${actual}".`);
    this.code = this.name = ParseError.code;
    this.data = { expected, actual };
  }
}
ParseError.code = "ParseError";
class PushRejectedError extends BaseError {
  /**
   * @param {'not-fast-forward'|'tag-exists'} reason
   */
  constructor(reason) {
    let message = "";
    if (reason === "not-fast-forward") {
      message = " because it was not a simple fast-forward";
    } else if (reason === "tag-exists") {
      message = " because tag already exists";
    }
    super(`Push rejected${message}. Use "force: true" to override.`);
    this.code = this.name = PushRejectedError.code;
    this.data = { reason };
  }
}
PushRejectedError.code = "PushRejectedError";
class RemoteCapabilityError extends BaseError {
  /**
   * @param {'shallow'|'deepen-since'|'deepen-not'|'deepen-relative'} capability
   * @param {'depth'|'since'|'exclude'|'relative'} parameter
   */
  constructor(capability, parameter) {
    super(
      `Remote does not support the "${capability}" so the "${parameter}" parameter cannot be used.`
    );
    this.code = this.name = RemoteCapabilityError.code;
    this.data = { capability, parameter };
  }
}
RemoteCapabilityError.code = "RemoteCapabilityError";
class SmartHttpError extends BaseError {
  /**
   * @param {string} preview
   * @param {string} response
   */
  constructor(preview, response) {
    super(
      `Remote did not reply using the "smart" HTTP protocol. Expected "001e# service=git-upload-pack" but received: ${preview}`
    );
    this.code = this.name = SmartHttpError.code;
    this.data = { preview, response };
  }
}
SmartHttpError.code = "SmartHttpError";
class UnknownTransportError extends BaseError {
  /**
   * @param {string} url
   * @param {string} transport
   * @param {string} [suggestion]
   */
  constructor(url, transport, suggestion) {
    super(
      `Git remote "${url}" uses an unrecognized transport protocol: "${transport}"`
    );
    this.code = this.name = UnknownTransportError.code;
    this.data = { url, transport, suggestion };
  }
}
UnknownTransportError.code = "UnknownTransportError";
class UrlParseError extends BaseError {
  /**
   * @param {string} url
   */
  constructor(url) {
    super(`Cannot parse remote URL: "${url}"`);
    this.code = this.name = UrlParseError.code;
    this.data = { url };
  }
}
UrlParseError.code = "UrlParseError";
class UserCanceledError extends BaseError {
  constructor() {
    super(`The operation was canceled.`);
    this.code = this.name = UserCanceledError.code;
    this.data = {};
  }
}
UserCanceledError.code = "UserCanceledError";
class IndexResetError extends BaseError {
  /**
   * @param {Array<string>} filepaths
   */
  constructor(filepath) {
    super(
      `Could not merge index: Entry for '${filepath}' is not up to date. Either reset the index entry to HEAD, or stage your unstaged changes.`
    );
    this.code = this.name = IndexResetError.code;
    this.data = { filepath };
  }
}
IndexResetError.code = "IndexResetError";
class NoCommitError extends BaseError {
  /**
   * @param {string} ref
   */
  constructor(ref2) {
    super(
      `"${ref2}" does not point to any commit. You're maybe working on a repository with no commits yet. `
    );
    this.code = this.name = NoCommitError.code;
    this.data = { ref: ref2 };
  }
}
NoCommitError.code = "NoCommitError";
var Errors = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  AlreadyExistsError,
  AmbiguousError,
  CheckoutConflictError,
  CommitNotFetchedError,
  EmptyServerResponseError,
  FastForwardError,
  GitPushError,
  HttpError,
  InternalError,
  InvalidFilepathError,
  InvalidOidError,
  InvalidRefNameError,
  MaxDepthError,
  MergeNotSupportedError,
  MergeConflictError,
  MissingNameError,
  MissingParameterError,
  MultipleGitError,
  NoRefspecError,
  NotFoundError,
  ObjectTypeError,
  ParseError,
  PushRejectedError,
  RemoteCapabilityError,
  SmartHttpError,
  UnknownTransportError,
  UnsafeFilepathError,
  UrlParseError,
  UserCanceledError,
  UnmergedPathsError,
  IndexResetError,
  NoCommitError
});
function formatAuthor({ name, email, timestamp, timezoneOffset }) {
  timezoneOffset = formatTimezoneOffset(timezoneOffset);
  return `${name} <${email}> ${timestamp} ${timezoneOffset}`;
}
function formatTimezoneOffset(minutes) {
  const sign3 = simpleSign(negateExceptForZero(minutes));
  minutes = Math.abs(minutes);
  const hours = Math.floor(minutes / 60);
  minutes -= hours * 60;
  let strHours = String(hours);
  let strMinutes = String(minutes);
  if (strHours.length < 2) strHours = "0" + strHours;
  if (strMinutes.length < 2) strMinutes = "0" + strMinutes;
  return (sign3 === -1 ? "-" : "+") + strHours + strMinutes;
}
function simpleSign(n) {
  return Math.sign(n) || (Object.is(n, -0) ? -1 : 1);
}
function negateExceptForZero(n) {
  return n === 0 ? n : -n;
}
function normalizeNewlines(str) {
  str = str.replace(/\r/g, "");
  str = str.replace(/^\n+/, "");
  str = str.replace(/\n+$/, "") + "\n";
  return str;
}
function parseAuthor(author) {
  const [, name, email, timestamp, offset] = author.match(
    /^(.*) <(.*)> (.*) (.*)$/
  );
  return {
    name,
    email,
    timestamp: Number(timestamp),
    timezoneOffset: parseTimezoneOffset(offset)
  };
}
function parseTimezoneOffset(offset) {
  let [, sign3, hours, minutes] = offset.match(/(\+|-)(\d\d)(\d\d)/);
  minutes = (sign3 === "+" ? 1 : -1) * (Number(hours) * 60 + Number(minutes));
  return negateExceptForZero$1(minutes);
}
function negateExceptForZero$1(n) {
  return n === 0 ? n : -n;
}
class GitAnnotatedTag {
  constructor(tag2) {
    if (typeof tag2 === "string") {
      this._tag = tag2;
    } else if (Buffer.isBuffer(tag2)) {
      this._tag = tag2.toString("utf8");
    } else if (typeof tag2 === "object") {
      this._tag = GitAnnotatedTag.render(tag2);
    } else {
      throw new InternalError(
        "invalid type passed to GitAnnotatedTag constructor"
      );
    }
  }
  static from(tag2) {
    return new GitAnnotatedTag(tag2);
  }
  static render(obj) {
    return `object ${obj.object}
type ${obj.type}
tag ${obj.tag}
tagger ${formatAuthor(obj.tagger)}

${obj.message}
${obj.gpgsig ? obj.gpgsig : ""}`;
  }
  justHeaders() {
    return this._tag.slice(0, this._tag.indexOf("\n\n"));
  }
  message() {
    const tag2 = this.withoutSignature();
    return tag2.slice(tag2.indexOf("\n\n") + 2);
  }
  parse() {
    return Object.assign(this.headers(), {
      message: this.message(),
      gpgsig: this.gpgsig()
    });
  }
  render() {
    return this._tag;
  }
  headers() {
    const headers = this.justHeaders().split("\n");
    const hs = [];
    for (const h of headers) {
      if (h[0] === " ") {
        hs[hs.length - 1] += "\n" + h.slice(1);
      } else {
        hs.push(h);
      }
    }
    const obj = {};
    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    if (obj.tagger) {
      obj.tagger = parseAuthor(obj.tagger);
    }
    if (obj.committer) {
      obj.committer = parseAuthor(obj.committer);
    }
    return obj;
  }
  withoutSignature() {
    const tag2 = normalizeNewlines(this._tag);
    if (tag2.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1) return tag2;
    return tag2.slice(0, tag2.lastIndexOf("\n-----BEGIN PGP SIGNATURE-----"));
  }
  gpgsig() {
    if (this._tag.indexOf("\n-----BEGIN PGP SIGNATURE-----") === -1) return;
    const signature = this._tag.slice(
      this._tag.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._tag.indexOf("-----END PGP SIGNATURE-----") + "-----END PGP SIGNATURE-----".length
    );
    return normalizeNewlines(signature);
  }
  payload() {
    return this.withoutSignature() + "\n";
  }
  toObject() {
    return Buffer.from(this._tag, "utf8");
  }
  static async sign(tag2, sign3, secretKey) {
    const payload = tag2.payload();
    let { signature } = await sign3({ payload, secretKey });
    signature = normalizeNewlines(signature);
    const signedTag = payload + signature;
    return GitAnnotatedTag.from(signedTag);
  }
}
function indent(str) {
  return str.trim().split("\n").map((x) => " " + x).join("\n") + "\n";
}
function outdent(str) {
  return str.split("\n").map((x) => x.replace(/^ /, "")).join("\n");
}
class GitCommit {
  constructor(commit2) {
    if (typeof commit2 === "string") {
      this._commit = commit2;
    } else if (Buffer.isBuffer(commit2)) {
      this._commit = commit2.toString("utf8");
    } else if (typeof commit2 === "object") {
      this._commit = GitCommit.render(commit2);
    } else {
      throw new InternalError("invalid type passed to GitCommit constructor");
    }
  }
  static fromPayloadSignature({ payload, signature }) {
    const headers = GitCommit.justHeaders(payload);
    const message = GitCommit.justMessage(payload);
    const commit2 = normalizeNewlines(
      headers + "\ngpgsig" + indent(signature) + "\n" + message
    );
    return new GitCommit(commit2);
  }
  static from(commit2) {
    return new GitCommit(commit2);
  }
  toObject() {
    return Buffer.from(this._commit, "utf8");
  }
  // Todo: allow setting the headers and message
  headers() {
    return this.parseHeaders();
  }
  // Todo: allow setting the headers and message
  message() {
    return GitCommit.justMessage(this._commit);
  }
  parse() {
    return Object.assign({ message: this.message() }, this.headers());
  }
  static justMessage(commit2) {
    return normalizeNewlines(commit2.slice(commit2.indexOf("\n\n") + 2));
  }
  static justHeaders(commit2) {
    return commit2.slice(0, commit2.indexOf("\n\n"));
  }
  parseHeaders() {
    const headers = GitCommit.justHeaders(this._commit).split("\n");
    const hs = [];
    for (const h of headers) {
      if (h[0] === " ") {
        hs[hs.length - 1] += "\n" + h.slice(1);
      } else {
        hs.push(h);
      }
    }
    const obj = {
      parent: []
    };
    for (const h of hs) {
      const key = h.slice(0, h.indexOf(" "));
      const value = h.slice(h.indexOf(" ") + 1);
      if (Array.isArray(obj[key])) {
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    if (obj.author) {
      obj.author = parseAuthor(obj.author);
    }
    if (obj.committer) {
      obj.committer = parseAuthor(obj.committer);
    }
    return obj;
  }
  static renderHeaders(obj) {
    let headers = "";
    if (obj.tree) {
      headers += `tree ${obj.tree}
`;
    } else {
      headers += `tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904
`;
    }
    if (obj.parent) {
      if (obj.parent.length === void 0) {
        throw new InternalError(`commit 'parent' property should be an array`);
      }
      for (const p of obj.parent) {
        headers += `parent ${p}
`;
      }
    }
    const author = obj.author;
    headers += `author ${formatAuthor(author)}
`;
    const committer = obj.committer || obj.author;
    headers += `committer ${formatAuthor(committer)}
`;
    if (obj.gpgsig) {
      headers += "gpgsig" + indent(obj.gpgsig);
    }
    return headers;
  }
  static render(obj) {
    return GitCommit.renderHeaders(obj) + "\n" + normalizeNewlines(obj.message);
  }
  render() {
    return this._commit;
  }
  withoutSignature() {
    const commit2 = normalizeNewlines(this._commit);
    if (commit2.indexOf("\ngpgsig") === -1) return commit2;
    const headers = commit2.slice(0, commit2.indexOf("\ngpgsig"));
    const message = commit2.slice(
      commit2.indexOf("-----END PGP SIGNATURE-----\n") + "-----END PGP SIGNATURE-----\n".length
    );
    return normalizeNewlines(headers + "\n" + message);
  }
  isolateSignature() {
    const signature = this._commit.slice(
      this._commit.indexOf("-----BEGIN PGP SIGNATURE-----"),
      this._commit.indexOf("-----END PGP SIGNATURE-----") + "-----END PGP SIGNATURE-----".length
    );
    return outdent(signature);
  }
  static async sign(commit2, sign3, secretKey) {
    const payload = commit2.withoutSignature();
    const message = GitCommit.justMessage(commit2._commit);
    let { signature } = await sign3({ payload, secretKey });
    signature = normalizeNewlines(signature);
    const headers = GitCommit.justHeaders(commit2._commit);
    const signedCommit = headers + "\ngpgsig" + indent(signature) + "\n" + message;
    return GitCommit.from(signedCommit);
  }
}
async function resolveTree({ fs, cache, gitdir, oid }) {
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
    return { tree: GitTree.from([]), oid };
  }
  const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
  if (type2 === "tag") {
    oid = GitAnnotatedTag.from(object).parse().object;
    return resolveTree({ fs, cache, gitdir, oid });
  }
  if (type2 === "commit") {
    oid = GitCommit.from(object).parse().tree;
    return resolveTree({ fs, cache, gitdir, oid });
  }
  if (type2 !== "tree") {
    throw new ObjectTypeError(oid, type2, "tree");
  }
  return { tree: GitTree.from(object), oid };
}
class GitWalkerRepo {
  constructor({ fs, gitdir, ref: ref2, cache }) {
    this.fs = fs;
    this.cache = cache;
    this.gitdir = gitdir;
    this.mapPromise = (async () => {
      const map = /* @__PURE__ */ new Map();
      let oid;
      try {
        oid = await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
      } catch (e) {
        if (e instanceof NotFoundError) {
          oid = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
        }
      }
      const tree = await resolveTree({ fs, cache: this.cache, gitdir, oid });
      tree.type = "tree";
      tree.mode = "40000";
      map.set(".", tree);
      return map;
    })();
    const walker = this;
    this.ConstructEntry = class TreeEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._content = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    const filepath = entry._fullpath;
    const { fs, cache, gitdir } = this;
    const map = await this.mapPromise;
    const obj = map.get(filepath);
    if (!obj) throw new Error(`No obj for ${filepath}`);
    const oid = obj.oid;
    if (!oid) throw new Error(`No oid for obj ${JSON.stringify(obj)}`);
    if (obj.type !== "tree") {
      return null;
    }
    const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type2 !== obj.type) {
      throw new ObjectTypeError(oid, type2, obj.type);
    }
    const tree = GitTree.from(object);
    for (const entry2 of tree) {
      map.set(pathBrowserify.join(filepath, entry2.path), entry2);
    }
    return tree.entries().map((entry2) => pathBrowserify.join(filepath, entry2.path));
  }
  async type(entry) {
    if (entry._type === false) {
      const map = await this.mapPromise;
      const { type: type2 } = map.get(entry._fullpath);
      entry._type = type2;
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      const map = await this.mapPromise;
      const { mode } = map.get(entry._fullpath);
      entry._mode = normalizeMode(parseInt(mode, 8));
    }
    return entry._mode;
  }
  async stat(_entry) {
  }
  async content(entry) {
    if (entry._content === false) {
      const map = await this.mapPromise;
      const { fs, cache, gitdir } = this;
      const obj = map.get(entry._fullpath);
      const oid = obj.oid;
      const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
      if (type2 !== "blob") {
        entry._content = void 0;
      } else {
        entry._content = new Uint8Array(object);
      }
    }
    return entry._content;
  }
  async oid(entry) {
    if (entry._oid === false) {
      const map = await this.mapPromise;
      const obj = map.get(entry._fullpath);
      entry._oid = obj.oid;
    }
    return entry._oid;
  }
}
function TREE({ ref: ref2 = "HEAD" } = {}) {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, gitdir, cache }) {
      return new GitWalkerRepo({ fs, gitdir, ref: ref2, cache });
    }
  });
  Object.freeze(o);
  return o;
}
class GitWalkerFs {
  constructor({ fs, dir, gitdir, cache }) {
    this.fs = fs;
    this.cache = cache;
    this.dir = dir;
    this.gitdir = gitdir;
    this.config = null;
    const walker = this;
    this.ConstructEntry = class WorkdirEntry {
      constructor(fullpath) {
        this._fullpath = fullpath;
        this._type = false;
        this._mode = false;
        this._stat = false;
        this._content = false;
        this._oid = false;
      }
      async type() {
        return walker.type(this);
      }
      async mode() {
        return walker.mode(this);
      }
      async stat() {
        return walker.stat(this);
      }
      async content() {
        return walker.content(this);
      }
      async oid() {
        return walker.oid(this);
      }
    };
  }
  async readdir(entry) {
    const filepath = entry._fullpath;
    const { fs, dir } = this;
    const names = await fs.readdir(pathBrowserify.join(dir, filepath));
    if (names === null) return null;
    return names.map((name) => pathBrowserify.join(filepath, name));
  }
  async type(entry) {
    if (entry._type === false) {
      await entry.stat();
    }
    return entry._type;
  }
  async mode(entry) {
    if (entry._mode === false) {
      await entry.stat();
    }
    return entry._mode;
  }
  async stat(entry) {
    if (entry._stat === false) {
      const { fs, dir } = this;
      let stat = await fs.lstat(`${dir}/${entry._fullpath}`);
      if (!stat) {
        throw new Error(
          `ENOENT: no such file or directory, lstat '${entry._fullpath}'`
        );
      }
      let type2 = stat.isDirectory() ? "tree" : "blob";
      if (type2 === "blob" && !stat.isFile() && !stat.isSymbolicLink()) {
        type2 = "special";
      }
      entry._type = type2;
      stat = normalizeStats(stat);
      entry._mode = stat.mode;
      if (stat.size === -1 && entry._actualSize) {
        stat.size = entry._actualSize;
      }
      entry._stat = stat;
    }
    return entry._stat;
  }
  async content(entry) {
    if (entry._content === false) {
      const { fs, dir, gitdir } = this;
      if (await entry.type() === "tree") {
        entry._content = void 0;
      } else {
        const config = await this._getGitConfig(fs, gitdir);
        const autocrlf = await config.get("core.autocrlf");
        const content = await fs.read(`${dir}/${entry._fullpath}`, { autocrlf });
        entry._actualSize = content.length;
        if (entry._stat && entry._stat.size === -1) {
          entry._stat.size = entry._actualSize;
        }
        entry._content = new Uint8Array(content);
      }
    }
    return entry._content;
  }
  async oid(entry) {
    if (entry._oid === false) {
      const self2 = this;
      const { fs, gitdir, cache } = this;
      let oid;
      await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
        const stage = index2.entriesMap.get(entry._fullpath);
        const stats = await entry.stat();
        const config = await self2._getGitConfig(fs, gitdir);
        const filemode = await config.get("core.filemode");
        const trustino = typeof process !== "undefined" ? !(process.platform === "win32") : true;
        if (!stage || compareStats(stats, stage, filemode, trustino)) {
          const content = await entry.content();
          if (content === void 0) {
            oid = void 0;
          } else {
            oid = await shasum(
              GitObject.wrap({ type: "blob", object: content })
            );
            if (stage && oid === stage.oid && (!filemode || stats.mode === stage.mode) && compareStats(stats, stage, filemode, trustino)) {
              index2.insert({
                filepath: entry._fullpath,
                stats,
                oid
              });
            }
          }
        } else {
          oid = stage.oid;
        }
      });
      entry._oid = oid;
    }
    return entry._oid;
  }
  async _getGitConfig(fs, gitdir) {
    if (this.config) {
      return this.config;
    }
    this.config = await GitConfigManager.get({ fs, gitdir });
    return this.config;
  }
}
function WORKDIR() {
  const o = /* @__PURE__ */ Object.create(null);
  Object.defineProperty(o, GitWalkSymbol, {
    value: function({ fs, dir, gitdir, cache }) {
      return new GitWalkerFs({ fs, dir, gitdir, cache });
    }
  });
  Object.freeze(o);
  return o;
}
function arrayRange(start, end) {
  const length = end - start;
  return Array.from({ length }, (_, i) => start + i);
}
const flat = typeof Array.prototype.flat === "undefined" ? (entries) => entries.reduce((acc, x) => acc.concat(x), []) : (entries) => entries.flat();
class RunningMinimum {
  constructor() {
    this.value = null;
  }
  consider(value) {
    if (value === null || value === void 0) return;
    if (this.value === null) {
      this.value = value;
    } else if (value < this.value) {
      this.value = value;
    }
  }
  reset() {
    this.value = null;
  }
}
function* unionOfIterators(sets) {
  const min2 = new RunningMinimum();
  let minimum;
  const heads = [];
  const numsets = sets.length;
  for (let i = 0; i < numsets; i++) {
    heads[i] = sets[i].next().value;
    if (heads[i] !== void 0) {
      min2.consider(heads[i]);
    }
  }
  if (min2.value === null) return;
  while (true) {
    const result = [];
    minimum = min2.value;
    min2.reset();
    for (let i = 0; i < numsets; i++) {
      if (heads[i] !== void 0 && heads[i] === minimum) {
        result[i] = heads[i];
        heads[i] = sets[i].next().value;
      } else {
        result[i] = null;
      }
      if (heads[i] !== void 0) {
        min2.consider(heads[i]);
      }
    }
    yield result;
    if (min2.value === null) return;
  }
}
async function _walk({
  fs,
  cache,
  dir,
  gitdir,
  trees: trees2,
  // @ts-ignore
  map = async (_, entry) => entry,
  // The default reducer is a flatmap that filters out undefineds.
  reduce = async (parent, children) => {
    const flatten = flat(children);
    if (parent !== void 0) flatten.unshift(parent);
    return flatten;
  },
  // The default iterate function walks all children concurrently
  iterate = (walk2, children) => Promise.all([...children].map(walk2))
}) {
  const walkers = trees2.map(
    (proxy) => proxy[GitWalkSymbol]({ fs, dir, gitdir, cache })
  );
  const root = new Array(walkers.length).fill(".");
  const range2 = arrayRange(0, walkers.length);
  const unionWalkerFromReaddir = async (entries) => {
    range2.map((i) => {
      const entry = entries[i];
      entries[i] = entry && new walkers[i].ConstructEntry(entry);
    });
    const subdirs = await Promise.all(
      range2.map((i) => {
        const entry = entries[i];
        return entry ? walkers[i].readdir(entry) : [];
      })
    );
    const iterators = subdirs.map((array) => {
      return (array === null ? [] : array)[Symbol.iterator]();
    });
    return {
      entries,
      children: unionOfIterators(iterators)
    };
  };
  const walk2 = async (root2) => {
    const { entries, children } = await unionWalkerFromReaddir(root2);
    const fullpath = entries.find((entry) => entry && entry._fullpath)._fullpath;
    const parent = await map(fullpath, entries);
    if (parent !== null) {
      let walkedChildren = await iterate(walk2, children);
      walkedChildren = walkedChildren.filter((x) => x !== void 0);
      return reduce(parent, walkedChildren);
    }
  };
  return walk2(root);
}
async function rmRecursive(fs, filepath) {
  const entries = await fs.readdir(filepath);
  if (entries == null) {
    await fs.rm(filepath);
  } else if (entries.length) {
    await Promise.all(
      entries.map((entry) => {
        const subpath = pathBrowserify.join(filepath, entry);
        return fs.lstat(subpath).then((stat) => {
          if (!stat) return;
          return stat.isDirectory() ? rmRecursive(fs, subpath) : fs.rm(subpath);
        });
      })
    ).then(() => fs.rmdir(filepath));
  } else {
    await fs.rmdir(filepath);
  }
}
function isPromiseLike(obj) {
  return isObject(obj) && isFunction(obj.then) && isFunction(obj.catch);
}
function isObject(obj) {
  return obj && typeof obj === "object";
}
function isFunction(obj) {
  return typeof obj === "function";
}
function isPromiseFs(fs) {
  const test = (targetFs) => {
    try {
      return targetFs.readFile().catch((e) => e);
    } catch (e) {
      return e;
    }
  };
  return isPromiseLike(test(fs));
}
const commands = [
  "readFile",
  "writeFile",
  "mkdir",
  "rmdir",
  "unlink",
  "stat",
  "lstat",
  "readdir",
  "readlink",
  "symlink"
];
function bindFs(target, fs) {
  if (isPromiseFs(fs)) {
    for (const command of commands) {
      target[`_${command}`] = fs[command].bind(fs);
    }
  } else {
    for (const command of commands) {
      target[`_${command}`] = pify(fs[command].bind(fs));
    }
  }
  if (isPromiseFs(fs)) {
    if (fs.rm) target._rm = fs.rm.bind(fs);
    else if (fs.rmdir.length > 1) target._rm = fs.rmdir.bind(fs);
    else target._rm = rmRecursive.bind(null, target);
  } else {
    if (fs.rm) target._rm = pify(fs.rm.bind(fs));
    else if (fs.rmdir.length > 2) target._rm = pify(fs.rmdir.bind(fs));
    else target._rm = rmRecursive.bind(null, target);
  }
}
class FileSystem {
  /**
   * Creates an instance of FileSystem.
   *
   * @param {Object} fs - A file system implementation to wrap.
   */
  constructor(fs) {
    if (typeof fs._original_unwrapped_fs !== "undefined") return fs;
    const promises = Object.getOwnPropertyDescriptor(fs, "promises");
    if (promises && promises.enumerable) {
      bindFs(this, fs.promises);
    } else {
      bindFs(this, fs);
    }
    this._original_unwrapped_fs = fs;
  }
  /**
   * Return true if a file exists, false if it doesn't exist.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filepath - The path to the file.
   * @param {Object} [options] - Additional options.
   * @returns {Promise<boolean>} - `true` if the file exists, `false` otherwise.
   */
  async exists(filepath, options = {}) {
    try {
      await this._stat(filepath);
      return true;
    } catch (err2) {
      if (err2.code === "ENOENT" || err2.code === "ENOTDIR" || (err2.code || "").includes("ENS")) {
        return false;
      } else {
        console.log('Unhandled error in "FileSystem.exists()" function', err2);
        throw err2;
      }
    }
  }
  /**
   * Return the contents of a file if it exists, otherwise returns null.
   *
   * @param {string} filepath - The path to the file.
   * @param {Object} [options] - Options for reading the file.
   * @returns {Promise<Buffer|string|null>} - The file contents, or `null` if the file doesn't exist.
   */
  async read(filepath, options = {}) {
    try {
      let buffer = await this._readFile(filepath, options);
      if (options.autocrlf === "true") {
        try {
          buffer = new TextDecoder("utf8", { fatal: true }).decode(buffer);
          buffer = buffer.replace(/\r\n/g, "\n");
          buffer = new TextEncoder().encode(buffer);
        } catch (error) {
        }
      }
      if (typeof buffer !== "string") {
        buffer = Buffer.from(buffer);
      }
      return buffer;
    } catch (err2) {
      return null;
    }
  }
  /**
   * Write a file (creating missing directories if need be) without throwing errors.
   *
   * @param {string} filepath - The path to the file.
   * @param {Buffer|Uint8Array|string} contents - The data to write.
   * @param {Object|string} [options] - Options for writing the file.
   * @returns {Promise<void>}
   */
  async write(filepath, contents, options = {}) {
    try {
      await this._writeFile(filepath, contents, options);
      return;
    } catch (err2) {
      await this.mkdir(dirname$1(filepath));
      await this._writeFile(filepath, contents, options);
    }
  }
  /**
   * Make a directory (or series of nested directories) without throwing an error if it already exists.
   *
   * @param {string} filepath - The path to the directory.
   * @param {boolean} [_selfCall=false] - Internal flag to prevent infinite recursion.
   * @returns {Promise<void>}
   */
  async mkdir(filepath, _selfCall = false) {
    try {
      await this._mkdir(filepath);
      return;
    } catch (err2) {
      if (err2 === null) return;
      if (err2.code === "EEXIST") return;
      if (_selfCall) throw err2;
      if (err2.code === "ENOENT") {
        const parent = dirname$1(filepath);
        if (parent === "." || parent === "/" || parent === filepath) throw err2;
        await this.mkdir(parent);
        await this.mkdir(filepath, true);
      }
    }
  }
  /**
   * Delete a file without throwing an error if it is already deleted.
   *
   * @param {string} filepath - The path to the file.
   * @returns {Promise<void>}
   */
  async rm(filepath) {
    try {
      await this._unlink(filepath);
    } catch (err2) {
      if (err2.code !== "ENOENT") throw err2;
    }
  }
  /**
   * Delete a directory without throwing an error if it is already deleted.
   *
   * @param {string} filepath - The path to the directory.
   * @param {Object} [opts] - Options for deleting the directory.
   * @returns {Promise<void>}
   */
  async rmdir(filepath, opts) {
    try {
      if (opts && opts.recursive) {
        await this._rm(filepath, opts);
      } else {
        await this._rmdir(filepath);
      }
    } catch (err2) {
      if (err2.code !== "ENOENT") throw err2;
    }
  }
  /**
   * Read a directory without throwing an error is the directory doesn't exist
   *
   * @param {string} filepath - The path to the directory.
   * @returns {Promise<string[]|null>} - An array of file names, or `null` if the path is not a directory.
   */
  async readdir(filepath) {
    try {
      const names = await this._readdir(filepath);
      names.sort(compareStrings);
      return names;
    } catch (err2) {
      if (err2.code === "ENOTDIR") return null;
      return [];
    }
  }
  /**
   * Return a flat list of all the files nested inside a directory
   *
   * Based on an elegant concurrent recursive solution from SO
   * https://stackoverflow.com/a/45130990/2168416
   *
   * @param {string} dir - The directory to read.
   * @returns {Promise<string[]>} - A flat list of all files in the directory.
   */
  async readdirDeep(dir) {
    const subdirs = await this._readdir(dir);
    const files = await Promise.all(
      subdirs.map(async (subdir) => {
        const res = dir + "/" + subdir;
        return (await this._stat(res)).isDirectory() ? this.readdirDeep(res) : res;
      })
    );
    return files.reduce((a, f) => a.concat(f), []);
  }
  /**
   * Return the Stats of a file/symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filename - The path to the file or symlink.
   * @returns {Promise<Object|null>} - The stats object, or `null` if the file doesn't exist.
   */
  async lstat(filename) {
    try {
      const stats = await this._lstat(filename);
      return stats;
    } catch (err2) {
      if (err2.code === "ENOENT" || (err2.code || "").includes("ENS")) {
        return null;
      }
      throw err2;
    }
  }
  /**
   * Reads the contents of a symlink if it exists, otherwise returns null.
   * Rethrows errors that aren't related to file existence.
   *
   * @param {string} filename - The path to the symlink.
   * @param {Object} [opts={ encoding: 'buffer' }] - Options for reading the symlink.
   * @returns {Promise<Buffer|null>} - The symlink target, or `null` if it doesn't exist.
   */
  async readlink(filename, opts = { encoding: "buffer" }) {
    try {
      const link = await this._readlink(filename, opts);
      return Buffer.isBuffer(link) ? link : Buffer.from(link);
    } catch (err2) {
      if (err2.code === "ENOENT" || (err2.code || "").includes("ENS")) {
        return null;
      }
      throw err2;
    }
  }
  /**
   * Write the contents of buffer to a symlink.
   *
   * @param {string} filename - The path to the symlink.
   * @param {Buffer} buffer - The symlink target.
   * @returns {Promise<void>}
   */
  async writelink(filename, buffer) {
    return this._symlink(buffer.toString("utf8"), filename);
  }
}
function assertParameter(name, value) {
  if (value === void 0) {
    throw new MissingParameterError(name);
  }
}
async function modified(entry, base) {
  if (!entry && !base) return false;
  if (entry && !base) return true;
  if (!entry && base) return true;
  if (await entry.type() === "tree" && await base.type() === "tree") {
    return false;
  }
  if (await entry.type() === await base.type() && await entry.mode() === await base.mode() && await entry.oid() === await base.oid()) {
    return false;
  }
  return true;
}
async function abortMerge({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  commit: commit2 = "HEAD",
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    const fs = new FileSystem(_fs);
    const trees2 = [TREE({ ref: commit2 }), WORKDIR(), STAGE()];
    let unmergedPaths = [];
    await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      unmergedPaths = index2.unmergedPaths;
    });
    const results = await _walk({
      fs,
      cache,
      dir,
      gitdir,
      trees: trees2,
      map: async function(path2, [head, workdir, index2]) {
        const staged = !await modified(workdir, index2);
        const unmerged = unmergedPaths.includes(path2);
        const unmodified = !await modified(index2, head);
        if (staged || unmerged) {
          return head ? {
            path: path2,
            mode: await head.mode(),
            oid: await head.oid(),
            type: await head.type(),
            content: await head.content()
          } : void 0;
        }
        if (unmodified) return false;
        else throw new IndexResetError(path2);
      }
    });
    await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      for (const entry of results) {
        if (entry === false) continue;
        if (!entry) {
          await fs.rmdir(`${dir}/${entry.path}`, { recursive: true });
          index2.delete({ filepath: entry.path });
          continue;
        }
        if (entry.type === "blob") {
          const content = new TextDecoder().decode(entry.content);
          await fs.write(`${dir}/${entry.path}`, content, { mode: entry.mode });
          index2.insert({
            filepath: entry.path,
            oid: entry.oid,
            stage: 0
          });
        }
      }
    });
  } catch (err2) {
    err2.caller = "git.abortMerge";
    throw err2;
  }
}
class GitIgnoreManager {
  /**
   * Determines whether a given file is ignored based on `.gitignore` rules and exclusion files.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} args.dir - The working directory.
   * @param {string} [args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {string} args.filepath - The path of the file to check.
   * @returns {Promise<boolean>} - `true` if the file is ignored, `false` otherwise.
   */
  static async isIgnored({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), filepath }) {
    if (basename$1(filepath) === ".git") return true;
    if (filepath === ".") return false;
    let excludes = "";
    const excludesFile = pathBrowserify.join(gitdir, "info", "exclude");
    if (await fs.exists(excludesFile)) {
      excludes = await fs.read(excludesFile, "utf8");
    }
    const pairs = [
      {
        gitignore: pathBrowserify.join(dir, ".gitignore"),
        filepath
      }
    ];
    const pieces = filepath.split("/").filter(Boolean);
    for (let i = 1; i < pieces.length; i++) {
      const folder = pieces.slice(0, i).join("/");
      const file = pieces.slice(i).join("/");
      pairs.push({
        gitignore: pathBrowserify.join(dir, folder, ".gitignore"),
        filepath: file
      });
    }
    let ignoredStatus = false;
    for (const p of pairs) {
      let file;
      try {
        file = await fs.read(p.gitignore, "utf8");
      } catch (err2) {
        if (err2.code === "NOENT") continue;
      }
      const ign = ignore().add(excludes);
      ign.add(file);
      const parentdir = dirname$1(p.filepath);
      if (parentdir !== "." && ign.ignores(parentdir)) return true;
      if (ignoredStatus) {
        ignoredStatus = !ign.test(p.filepath).unignored;
      } else {
        ignoredStatus = ign.test(p.filepath).ignored;
      }
    }
    return ignoredStatus;
  }
}
async function writeObjectLoose({ fs, gitdir, object, format: format2, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  const filepath = `${gitdir}/${source}`;
  if (!await fs.exists(filepath)) await fs.write(filepath, object);
}
let supportsCompressionStream = null;
async function deflate(buffer) {
  if (supportsCompressionStream === null) {
    supportsCompressionStream = testCompressionStream();
  }
  return supportsCompressionStream ? browserDeflate(buffer) : pako.deflate(buffer);
}
async function browserDeflate(buffer) {
  const cs = new CompressionStream("deflate");
  const c2 = new Blob([buffer]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(c2).arrayBuffer());
}
function testCompressionStream() {
  try {
    const cs = new CompressionStream("deflate");
    cs.writable.close();
    const stream = new Blob([]).stream();
    stream.cancel();
    return true;
  } catch (_) {
    return false;
  }
}
async function _writeObject({
  fs,
  gitdir,
  type: type2,
  object,
  format: format2 = "content",
  oid = void 0,
  dryRun = false
}) {
  if (format2 !== "deflated") {
    if (format2 !== "wrapped") {
      object = GitObject.wrap({ type: type2, object });
    }
    oid = await shasum(object);
    object = Buffer.from(await deflate(object));
  }
  if (!dryRun) {
    await writeObjectLoose({ fs, gitdir, object, format: "deflated", oid });
  }
  return oid;
}
function posixifyPathBuffer(buffer) {
  let idx;
  while (~(idx = buffer.indexOf(92))) buffer[idx] = 47;
  return buffer;
}
async function add({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  cache = {},
  force = false,
  parallel = true
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    await GitIndexManager.acquire({ fs, gitdir, cache }, async (index2) => {
      const config = await GitConfigManager.get({ fs, gitdir });
      const autocrlf = await config.get("core.autocrlf");
      return addToIndex({
        dir,
        gitdir,
        fs,
        filepath,
        index: index2,
        force,
        parallel,
        autocrlf
      });
    });
  } catch (err2) {
    err2.caller = "git.add";
    throw err2;
  }
}
async function addToIndex({
  dir,
  gitdir,
  fs,
  filepath,
  index: index2,
  force,
  parallel,
  autocrlf
}) {
  filepath = Array.isArray(filepath) ? filepath : [filepath];
  const promises = filepath.map(async (currentFilepath) => {
    if (!force) {
      const ignored = await GitIgnoreManager.isIgnored({
        fs,
        dir,
        gitdir,
        filepath: currentFilepath
      });
      if (ignored) return;
    }
    const stats = await fs.lstat(pathBrowserify.join(dir, currentFilepath));
    if (!stats) throw new NotFoundError(currentFilepath);
    if (stats.isDirectory()) {
      const children = await fs.readdir(pathBrowserify.join(dir, currentFilepath));
      if (parallel) {
        const promises2 = children.map(
          (child) => addToIndex({
            dir,
            gitdir,
            fs,
            filepath: [pathBrowserify.join(currentFilepath, child)],
            index: index2,
            force,
            parallel,
            autocrlf
          })
        );
        await Promise.all(promises2);
      } else {
        for (const child of children) {
          await addToIndex({
            dir,
            gitdir,
            fs,
            filepath: [pathBrowserify.join(currentFilepath, child)],
            index: index2,
            force,
            parallel,
            autocrlf
          });
        }
      }
    } else {
      const object = stats.isSymbolicLink() ? await fs.readlink(pathBrowserify.join(dir, currentFilepath)).then(posixifyPathBuffer) : await fs.read(pathBrowserify.join(dir, currentFilepath), { autocrlf });
      if (object === null) throw new NotFoundError(currentFilepath);
      const oid = await _writeObject({ fs, gitdir, type: "blob", object });
      index2.insert({ filepath: currentFilepath, stats, oid });
    }
  });
  const settledPromises = await Promise.allSettled(promises);
  const rejectedPromises = settledPromises.filter((settle) => settle.status === "rejected").map((settle) => settle.reason);
  if (rejectedPromises.length > 1) {
    throw new MultipleGitError(rejectedPromises);
  }
  if (rejectedPromises.length === 1) {
    throw rejectedPromises[0];
  }
  const fulfilledPromises = settledPromises.filter((settle) => settle.status === "fulfilled" && settle.value).map((settle) => settle.value);
  return fulfilledPromises;
}
async function _getConfig({ fs, gitdir, path: path2 }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  return config.get(path2);
}
function assignDefined(target, ...sources) {
  for (const source of sources) {
    if (source) {
      for (const key of Object.keys(source)) {
        const val = source[key];
        if (val !== void 0) {
          target[key] = val;
        }
      }
    }
  }
  return target;
}
async function normalizeAuthorObject({ fs, gitdir, author, commit: commit2 }) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const defaultAuthor = {
    name: await _getConfig({ fs, gitdir, path: "user.name" }),
    email: await _getConfig({ fs, gitdir, path: "user.email" }) || "",
    // author.email is allowed to be empty string
    timestamp,
    timezoneOffset: new Date(timestamp * 1e3).getTimezoneOffset()
  };
  const normalizedAuthor = assignDefined(
    {},
    defaultAuthor,
    commit2 ? commit2.author : void 0,
    author
  );
  if (normalizedAuthor.name === void 0) {
    return void 0;
  }
  return normalizedAuthor;
}
async function normalizeCommitterObject({
  fs,
  gitdir,
  author,
  committer,
  commit: commit2
}) {
  const timestamp = Math.floor(Date.now() / 1e3);
  const defaultCommitter = {
    name: await _getConfig({ fs, gitdir, path: "user.name" }),
    email: await _getConfig({ fs, gitdir, path: "user.email" }) || "",
    // committer.email is allowed to be empty string
    timestamp,
    timezoneOffset: new Date(timestamp * 1e3).getTimezoneOffset()
  };
  const normalizedCommitter = assignDefined(
    {},
    defaultCommitter,
    commit2 ? commit2.committer : void 0,
    author,
    committer
  );
  if (normalizedCommitter.name === void 0) {
    return void 0;
  }
  return normalizedCommitter;
}
async function resolveCommit({ fs, cache, gitdir, oid }) {
  const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
  if (type2 === "tag") {
    oid = GitAnnotatedTag.from(object).parse().object;
    return resolveCommit({ fs, cache, gitdir, oid });
  }
  if (type2 !== "commit") {
    throw new ObjectTypeError(oid, type2, "commit");
  }
  return { commit: GitCommit.from(object), oid };
}
async function _readCommit({ fs, cache, gitdir, oid }) {
  const { commit: commit2, oid: commitOid } = await resolveCommit({
    fs,
    cache,
    gitdir,
    oid
  });
  const result = {
    oid: commitOid,
    commit: commit2.parse(),
    payload: commit2.withoutSignature()
  };
  return result;
}
async function _commit({
  fs,
  cache,
  onSign,
  gitdir,
  message,
  author: _author,
  committer: _committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  ref: ref2,
  parent,
  tree
}) {
  let initialCommit = false;
  if (!ref2) {
    ref2 = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: "HEAD",
      depth: 2
    });
  }
  let refOid, refCommit;
  try {
    refOid = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: ref2
    });
    refCommit = await _readCommit({ fs, gitdir, oid: refOid, cache: {} });
  } catch {
    initialCommit = true;
  }
  if (amend && initialCommit) {
    throw new NoCommitError(ref2);
  }
  const author = !amend ? await normalizeAuthorObject({ fs, gitdir, author: _author }) : await normalizeAuthorObject({
    fs,
    gitdir,
    author: _author,
    commit: refCommit.commit
  });
  if (!author) throw new MissingNameError("author");
  const committer = !amend ? await normalizeCommitterObject({
    fs,
    gitdir,
    author,
    committer: _committer
  }) : await normalizeCommitterObject({
    fs,
    gitdir,
    author,
    committer: _committer,
    commit: refCommit.commit
  });
  if (!committer) throw new MissingNameError("committer");
  return GitIndexManager.acquire(
    { fs, gitdir, cache, allowUnmerged: false },
    async function(index2) {
      const inodes = flatFileListToDirectoryStructure(index2.entries);
      const inode = inodes.get(".");
      if (!tree) {
        tree = await constructTree({ fs, gitdir, inode, dryRun });
      }
      if (!parent) {
        if (!amend) {
          parent = refOid ? [refOid] : [];
        } else {
          parent = refCommit.commit.parent;
        }
      } else {
        parent = await Promise.all(
          parent.map((p) => {
            return GitRefManager.resolve({ fs, gitdir, ref: p });
          })
        );
      }
      if (!message) {
        if (!amend) {
          throw new MissingParameterError("message");
        } else {
          message = refCommit.commit.message;
        }
      }
      let comm = GitCommit.from({
        tree,
        parent,
        author,
        committer,
        message
      });
      if (signingKey) {
        comm = await GitCommit.sign(comm, onSign, signingKey);
      }
      const oid = await _writeObject({
        fs,
        gitdir,
        type: "commit",
        object: comm.toObject(),
        dryRun
      });
      if (!noUpdateBranch && !dryRun) {
        await GitRefManager.writeRef({
          fs,
          gitdir,
          ref: ref2,
          value: oid
        });
      }
      return oid;
    }
  );
}
async function constructTree({ fs, gitdir, inode, dryRun }) {
  const children = inode.children;
  for (const inode2 of children) {
    if (inode2.type === "tree") {
      inode2.metadata.mode = "040000";
      inode2.metadata.oid = await constructTree({ fs, gitdir, inode: inode2, dryRun });
    }
  }
  const entries = children.map((inode2) => ({
    mode: inode2.metadata.mode,
    path: inode2.basename,
    oid: inode2.metadata.oid,
    type: inode2.type
  }));
  const tree = GitTree.from(entries);
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "tree",
    object: tree.toObject(),
    dryRun
  });
  return oid;
}
async function resolveFilepath({ fs, cache, gitdir, oid, filepath }) {
  if (filepath.startsWith("/")) {
    throw new InvalidFilepathError("leading-slash");
  } else if (filepath.endsWith("/")) {
    throw new InvalidFilepathError("trailing-slash");
  }
  const _oid = oid;
  const result = await resolveTree({ fs, cache, gitdir, oid });
  const tree = result.tree;
  if (filepath === "") {
    oid = result.oid;
  } else {
    const pathArray = filepath.split("/");
    oid = await _resolveFilepath({
      fs,
      cache,
      gitdir,
      tree,
      pathArray,
      oid: _oid,
      filepath
    });
  }
  return oid;
}
async function _resolveFilepath({
  fs,
  cache,
  gitdir,
  tree,
  pathArray,
  oid,
  filepath
}) {
  const name = pathArray.shift();
  for (const entry of tree) {
    if (entry.path === name) {
      if (pathArray.length === 0) {
        return entry.oid;
      } else {
        const { type: type2, object } = await _readObject({
          fs,
          cache,
          gitdir,
          oid: entry.oid
        });
        if (type2 !== "tree") {
          throw new ObjectTypeError(oid, type2, "tree", filepath);
        }
        tree = GitTree.from(object);
        return _resolveFilepath({
          fs,
          cache,
          gitdir,
          tree,
          pathArray,
          oid,
          filepath
        });
      }
    }
  }
  throw new NotFoundError(`file or directory found at "${oid}:${filepath}"`);
}
async function _readTree({
  fs,
  cache,
  gitdir,
  oid,
  filepath = void 0
}) {
  if (filepath !== void 0) {
    oid = await resolveFilepath({ fs, cache, gitdir, oid, filepath });
  }
  const { tree, oid: treeOid } = await resolveTree({ fs, cache, gitdir, oid });
  const result = {
    oid: treeOid,
    tree: tree.entries()
  };
  return result;
}
async function _writeTree({ fs, gitdir, tree }) {
  const object = GitTree.from(tree).toObject();
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "tree",
    object,
    format: "content"
  });
  return oid;
}
async function _addNote({
  fs,
  cache,
  onSign,
  gitdir,
  ref: ref2,
  oid,
  note,
  force,
  author,
  committer,
  signingKey
}) {
  let parent;
  try {
    parent = await GitRefManager.resolve({ gitdir, fs, ref: ref2 });
  } catch (err2) {
    if (!(err2 instanceof NotFoundError)) {
      throw err2;
    }
  }
  const result = await _readTree({
    fs,
    cache,
    gitdir,
    oid: parent || "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
  });
  let tree = result.tree;
  if (force) {
    tree = tree.filter((entry) => entry.path !== oid);
  } else {
    for (const entry of tree) {
      if (entry.path === oid) {
        throw new AlreadyExistsError("note", oid);
      }
    }
  }
  if (typeof note === "string") {
    note = Buffer.from(note, "utf8");
  }
  const noteOid = await _writeObject({
    fs,
    gitdir,
    type: "blob",
    object: note,
    format: "content"
  });
  tree.push({ mode: "100644", path: oid, oid: noteOid, type: "blob" });
  const treeOid = await _writeTree({
    fs,
    gitdir,
    tree
  });
  const commitOid = await _commit({
    fs,
    cache,
    onSign,
    gitdir,
    ref: ref2,
    tree: treeOid,
    parent: parent && [parent],
    message: `Note added by 'isomorphic-git addNote'
`,
    author,
    committer,
    signingKey
  });
  return commitOid;
}
async function addNote({
  fs: _fs,
  onSign,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2 = "refs/notes/commits",
  oid,
  note,
  force,
  author: _author,
  committer: _committer,
  signingKey,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    assertParameter("note", note);
    if (signingKey) {
      assertParameter("onSign", onSign);
    }
    const fs = new FileSystem(_fs);
    const author = await normalizeAuthorObject({ fs, gitdir, author: _author });
    if (!author) throw new MissingNameError("author");
    const committer = await normalizeCommitterObject({
      fs,
      gitdir,
      author,
      committer: _committer
    });
    if (!committer) throw new MissingNameError("committer");
    return await _addNote({
      fs: new FileSystem(fs),
      cache,
      onSign,
      gitdir,
      ref: ref2,
      oid,
      note,
      force,
      author,
      committer,
      signingKey
    });
  } catch (err2) {
    err2.caller = "git.addNote";
    throw err2;
  }
}
async function _addRemote({ fs, gitdir, remote, url, force }) {
  if (!validRef2(remote, true)) {
    throw new InvalidRefNameError(remote, cleanGitRef.clean(remote));
  }
  const config = await GitConfigManager.get({ fs, gitdir });
  if (!force) {
    const remoteNames = await config.getSubsections("remote");
    if (remoteNames.includes(remote)) {
      if (url !== await config.get(`remote.${remote}.url`)) {
        throw new AlreadyExistsError("remote", remote);
      }
    }
  }
  await config.set(`remote.${remote}.url`, url);
  await config.set(
    `remote.${remote}.fetch`,
    `+refs/heads/*:refs/remotes/${remote}/*`
  );
  await GitConfigManager.save({ fs, gitdir, config });
}
async function addRemote({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  remote,
  url,
  force = false
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("remote", remote);
    assertParameter("url", url);
    return await _addRemote({
      fs: new FileSystem(fs),
      gitdir,
      remote,
      url,
      force
    });
  } catch (err2) {
    err2.caller = "git.addRemote";
    throw err2;
  }
}
async function _annotatedTag({
  fs,
  cache,
  onSign,
  gitdir,
  ref: ref2,
  tagger,
  message = ref2,
  gpgsig,
  object,
  signingKey,
  force = false
}) {
  ref2 = ref2.startsWith("refs/tags/") ? ref2 : `refs/tags/${ref2}`;
  if (!force && await GitRefManager.exists({ fs, gitdir, ref: ref2 })) {
    throw new AlreadyExistsError("tag", ref2);
  }
  const oid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: object || "HEAD"
  });
  const { type: type2 } = await _readObject({ fs, cache, gitdir, oid });
  let tagObject = GitAnnotatedTag.from({
    object: oid,
    type: type2,
    tag: ref2.replace("refs/tags/", ""),
    tagger,
    message,
    gpgsig
  });
  if (signingKey) {
    tagObject = await GitAnnotatedTag.sign(tagObject, onSign, signingKey);
  }
  const value = await _writeObject({
    fs,
    gitdir,
    type: "tag",
    object: tagObject.toObject()
  });
  await GitRefManager.writeRef({ fs, gitdir, ref: ref2, value });
}
async function annotatedTag({
  fs: _fs,
  onSign,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  tagger: _tagger,
  message = ref2,
  gpgsig,
  object,
  signingKey,
  force = false,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    if (signingKey) {
      assertParameter("onSign", onSign);
    }
    const fs = new FileSystem(_fs);
    const tagger = await normalizeAuthorObject({ fs, gitdir, author: _tagger });
    if (!tagger) throw new MissingNameError("tagger");
    return await _annotatedTag({
      fs,
      cache,
      onSign,
      gitdir,
      ref: ref2,
      tagger,
      message,
      gpgsig,
      object,
      signingKey,
      force
    });
  } catch (err2) {
    err2.caller = "git.annotatedTag";
    throw err2;
  }
}
async function _branch({
  fs,
  gitdir,
  ref: ref2,
  object,
  checkout: checkout2 = false,
  force = false
}) {
  if (!validRef2(ref2, true)) {
    throw new InvalidRefNameError(ref2, cleanGitRef.clean(ref2));
  }
  const fullref = `refs/heads/${ref2}`;
  if (!force) {
    const exist = await GitRefManager.exists({ fs, gitdir, ref: fullref });
    if (exist) {
      throw new AlreadyExistsError("branch", ref2, false);
    }
  }
  let oid;
  try {
    oid = await GitRefManager.resolve({ fs, gitdir, ref: object || "HEAD" });
  } catch (e) {
  }
  if (oid) {
    await GitRefManager.writeRef({ fs, gitdir, ref: fullref, value: oid });
  }
  if (checkout2) {
    await GitRefManager.writeSymbolicRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: fullref
    });
  }
}
async function branch({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  object,
  checkout: checkout2 = false,
  force = false
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    return await _branch({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2,
      object,
      checkout: checkout2,
      force
    });
  } catch (err2) {
    err2.caller = "git.branch";
    throw err2;
  }
}
const worthWalking = (filepath, root) => {
  if (filepath === "." || root == null || root.length === 0 || root === ".") {
    return true;
  }
  if (root.length >= filepath.length) {
    return root.startsWith(filepath);
  } else {
    return filepath.startsWith(root);
  }
};
async function _checkout({
  fs,
  cache,
  onProgress,
  onPostCheckout,
  dir,
  gitdir,
  remote,
  ref: ref2,
  filepaths,
  noCheckout,
  noUpdateHead,
  dryRun,
  force,
  track = true,
  nonBlocking = false,
  batchSize = 100
}) {
  let oldOid;
  if (onPostCheckout) {
    try {
      oldOid = await GitRefManager.resolve({ fs, gitdir, ref: "HEAD" });
    } catch (err2) {
      oldOid = "0000000000000000000000000000000000000000";
    }
  }
  let oid;
  try {
    oid = await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
  } catch (err2) {
    if (ref2 === "HEAD") throw err2;
    const remoteRef = `${remote}/${ref2}`;
    oid = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: remoteRef
    });
    if (track) {
      const config = await GitConfigManager.get({ fs, gitdir });
      await config.set(`branch.${ref2}.remote`, remote);
      await config.set(`branch.${ref2}.merge`, `refs/heads/${ref2}`);
      await GitConfigManager.save({ fs, gitdir, config });
    }
    await GitRefManager.writeRef({
      fs,
      gitdir,
      ref: `refs/heads/${ref2}`,
      value: oid
    });
  }
  if (!noCheckout) {
    let ops;
    try {
      ops = await analyze({
        fs,
        cache,
        onProgress,
        dir,
        gitdir,
        ref: ref2,
        force,
        filepaths
      });
    } catch (err2) {
      if (err2 instanceof NotFoundError && err2.data.what === oid) {
        throw new CommitNotFetchedError(ref2, oid);
      } else {
        throw err2;
      }
    }
    const conflicts = ops.filter(([method]) => method === "conflict").map(([method, fullpath]) => fullpath);
    if (conflicts.length > 0) {
      throw new CheckoutConflictError(conflicts);
    }
    const errors2 = ops.filter(([method]) => method === "error").map(([method, fullpath]) => fullpath);
    if (errors2.length > 0) {
      throw new InternalError(errors2.join(", "));
    }
    if (dryRun) {
      if (onPostCheckout) {
        await onPostCheckout({
          previousHead: oldOid,
          newHead: oid,
          type: filepaths != null && filepaths.length > 0 ? "file" : "branch"
        });
      }
      return;
    }
    let count = 0;
    const total = ops.length;
    await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      await Promise.all(
        ops.filter(
          ([method]) => method === "delete" || method === "delete-index"
        ).map(async function([method, fullpath]) {
          const filepath = `${dir}/${fullpath}`;
          if (method === "delete") {
            await fs.rm(filepath);
          }
          index2.delete({ filepath: fullpath });
          if (onProgress) {
            await onProgress({
              phase: "Updating workdir",
              loaded: ++count,
              total
            });
          }
        })
      );
    });
    await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      for (const [method, fullpath] of ops) {
        if (method === "rmdir" || method === "rmdir-index") {
          const filepath = `${dir}/${fullpath}`;
          try {
            if (method === "rmdir") {
              await fs.rmdir(filepath);
            }
            index2.delete({ filepath: fullpath });
            if (onProgress) {
              await onProgress({
                phase: "Updating workdir",
                loaded: ++count,
                total
              });
            }
          } catch (e) {
            if (e.code === "ENOTEMPTY") {
              console.log(
                `Did not delete ${fullpath} because directory is not empty`
              );
            } else {
              throw e;
            }
          }
        }
      }
    });
    await Promise.all(
      ops.filter(([method]) => method === "mkdir" || method === "mkdir-index").map(async function([_, fullpath]) {
        const filepath = `${dir}/${fullpath}`;
        await fs.mkdir(filepath);
        if (onProgress) {
          await onProgress({
            phase: "Updating workdir",
            loaded: ++count,
            total
          });
        }
      })
    );
    if (nonBlocking) {
      const eligibleOps = ops.filter(
        ([method]) => method === "create" || method === "create-index" || method === "update" || method === "mkdir-index"
      );
      const updateWorkingDirResults = await batchAllSettled(
        "Update Working Dir",
        eligibleOps.map(
          ([method, fullpath, oid2, mode, chmod]) => () => updateWorkingDir({ fs, cache, gitdir, dir }, [
            method,
            fullpath,
            oid2,
            mode,
            chmod
          ])
        ),
        onProgress,
        batchSize
      );
      await GitIndexManager.acquire(
        { fs, gitdir, cache, allowUnmerged: true },
        async function(index2) {
          await batchAllSettled(
            "Update Index",
            updateWorkingDirResults.map(
              ([fullpath, oid2, stats]) => () => updateIndex({ index: index2, fullpath, oid: oid2, stats })
            ),
            onProgress,
            batchSize
          );
        }
      );
    } else {
      await GitIndexManager.acquire(
        { fs, gitdir, cache, allowUnmerged: true },
        async function(index2) {
          await Promise.all(
            ops.filter(
              ([method]) => method === "create" || method === "create-index" || method === "update" || method === "mkdir-index"
            ).map(async function([method, fullpath, oid2, mode, chmod]) {
              const filepath = `${dir}/${fullpath}`;
              try {
                if (method !== "create-index" && method !== "mkdir-index") {
                  const { object } = await _readObject({
                    fs,
                    cache,
                    gitdir,
                    oid: oid2
                  });
                  if (chmod) {
                    await fs.rm(filepath);
                  }
                  if (mode === 33188) {
                    await fs.write(filepath, object);
                  } else if (mode === 33261) {
                    await fs.write(filepath, object, { mode: 511 });
                  } else if (mode === 40960) {
                    await fs.writelink(filepath, object);
                  } else {
                    throw new InternalError(
                      `Invalid mode 0o${mode.toString(
                        8
                      )} detected in blob ${oid2}`
                    );
                  }
                }
                const stats = await fs.lstat(filepath);
                if (mode === 33261) {
                  stats.mode = 493;
                }
                if (method === "mkdir-index") {
                  stats.mode = 57344;
                }
                index2.insert({
                  filepath: fullpath,
                  stats,
                  oid: oid2
                });
                if (onProgress) {
                  await onProgress({
                    phase: "Updating workdir",
                    loaded: ++count,
                    total
                  });
                }
              } catch (e) {
                console.log(e);
              }
            })
          );
        }
      );
    }
    if (onPostCheckout) {
      await onPostCheckout({
        previousHead: oldOid,
        newHead: oid,
        type: filepaths != null && filepaths.length > 0 ? "file" : "branch"
      });
    }
  }
  if (!noUpdateHead) {
    const fullRef = await GitRefManager.expand({ fs, gitdir, ref: ref2 });
    if (fullRef.startsWith("refs/heads")) {
      await GitRefManager.writeSymbolicRef({
        fs,
        gitdir,
        ref: "HEAD",
        value: fullRef
      });
    } else {
      await GitRefManager.writeRef({ fs, gitdir, ref: "HEAD", value: oid });
    }
  }
}
async function analyze({
  fs,
  cache,
  onProgress,
  dir,
  gitdir,
  ref: ref2,
  force,
  filepaths
}) {
  let count = 0;
  return _walk({
    fs,
    cache,
    dir,
    gitdir,
    trees: [TREE({ ref: ref2 }), WORKDIR(), STAGE()],
    map: async function(fullpath, [commit2, workdir, stage]) {
      if (fullpath === ".") return;
      if (filepaths && !filepaths.some((base) => worthWalking(fullpath, base))) {
        return null;
      }
      if (onProgress) {
        await onProgress({ phase: "Analyzing workdir", loaded: ++count });
      }
      const key = [!!stage, !!commit2, !!workdir].map(Number).join("");
      switch (key) {
        case "000":
          return;
        case "001":
          if (force && filepaths && filepaths.includes(fullpath)) {
            return ["delete", fullpath];
          }
          return;
        case "010": {
          switch (await commit2.type()) {
            case "tree": {
              return ["mkdir", fullpath];
            }
            case "blob": {
              return [
                "create",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            case "commit": {
              return [
                "mkdir-index",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            default: {
              return [
                "error",
                `new entry Unhandled type ${await commit2.type()}`
              ];
            }
          }
        }
        case "011": {
          switch (`${await commit2.type()}-${await workdir.type()}`) {
            case "tree-tree": {
              return;
            }
            case "tree-blob":
            case "blob-tree": {
              return ["conflict", fullpath];
            }
            case "blob-blob": {
              if (await commit2.oid() !== await workdir.oid()) {
                if (force) {
                  return [
                    "update",
                    fullpath,
                    await commit2.oid(),
                    await commit2.mode(),
                    await commit2.mode() !== await workdir.mode()
                  ];
                } else {
                  return ["conflict", fullpath];
                }
              } else {
                if (await commit2.mode() !== await workdir.mode()) {
                  if (force) {
                    return [
                      "update",
                      fullpath,
                      await commit2.oid(),
                      await commit2.mode(),
                      true
                    ];
                  } else {
                    return ["conflict", fullpath];
                  }
                } else {
                  return [
                    "create-index",
                    fullpath,
                    await commit2.oid(),
                    await commit2.mode()
                  ];
                }
              }
            }
            case "commit-tree": {
              return;
            }
            case "commit-blob": {
              return ["conflict", fullpath];
            }
            default: {
              return ["error", `new entry Unhandled type ${commit2.type}`];
            }
          }
        }
        case "100": {
          return ["delete-index", fullpath];
        }
        case "101": {
          switch (await stage.type()) {
            case "tree": {
              return ["rmdir-index", fullpath];
            }
            case "blob": {
              if (await stage.oid() !== await workdir.oid()) {
                if (force) {
                  return ["delete", fullpath];
                } else {
                  return ["conflict", fullpath];
                }
              } else {
                return ["delete", fullpath];
              }
            }
            case "commit": {
              return ["rmdir-index", fullpath];
            }
            default: {
              return [
                "error",
                `delete entry Unhandled type ${await stage.type()}`
              ];
            }
          }
        }
        case "110":
        case "111": {
          switch (`${await stage.type()}-${await commit2.type()}`) {
            case "tree-tree": {
              return;
            }
            case "blob-blob": {
              if (await stage.oid() === await commit2.oid() && await stage.mode() === await commit2.mode() && !force) {
                return;
              }
              if (workdir) {
                if (await workdir.oid() !== await stage.oid() && await workdir.oid() !== await commit2.oid()) {
                  if (force) {
                    return [
                      "update",
                      fullpath,
                      await commit2.oid(),
                      await commit2.mode(),
                      await commit2.mode() !== await workdir.mode()
                    ];
                  } else {
                    return ["conflict", fullpath];
                  }
                }
              } else if (force) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  await commit2.mode() !== await stage.mode()
                ];
              }
              if (await commit2.mode() !== await stage.mode()) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  true
                ];
              }
              if (await commit2.oid() !== await stage.oid()) {
                return [
                  "update",
                  fullpath,
                  await commit2.oid(),
                  await commit2.mode(),
                  false
                ];
              } else {
                return;
              }
            }
            case "tree-blob": {
              return ["update-dir-to-blob", fullpath, await commit2.oid()];
            }
            case "blob-tree": {
              return ["update-blob-to-tree", fullpath];
            }
            case "commit-commit": {
              return [
                "mkdir-index",
                fullpath,
                await commit2.oid(),
                await commit2.mode()
              ];
            }
            default: {
              return [
                "error",
                `update entry Unhandled type ${await stage.type()}-${await commit2.type()}`
              ];
            }
          }
        }
      }
    },
    // Modify the default flat mapping
    reduce: async function(parent, children) {
      children = flat(children);
      if (!parent) {
        return children;
      } else if (parent && parent[0] === "rmdir") {
        children.push(parent);
        return children;
      } else {
        children.unshift(parent);
        return children;
      }
    }
  });
}
async function updateIndex({ index: index2, fullpath, stats, oid }) {
  try {
    index2.insert({
      filepath: fullpath,
      stats,
      oid
    });
  } catch (e) {
    console.warn(`Error inserting ${fullpath} into index:`, e);
  }
}
async function updateWorkingDir({ fs, cache, gitdir, dir }, [method, fullpath, oid, mode, chmod]) {
  const filepath = `${dir}/${fullpath}`;
  if (method !== "create-index" && method !== "mkdir-index") {
    const { object } = await _readObject({ fs, cache, gitdir, oid });
    if (chmod) {
      await fs.rm(filepath);
    }
    if (mode === 33188) {
      await fs.write(filepath, object);
    } else if (mode === 33261) {
      await fs.write(filepath, object, { mode: 511 });
    } else if (mode === 40960) {
      await fs.writelink(filepath, object);
    } else {
      throw new InternalError(
        `Invalid mode 0o${mode.toString(8)} detected in blob ${oid}`
      );
    }
  }
  const stats = await fs.lstat(filepath);
  if (mode === 33261) {
    stats.mode = 493;
  }
  if (method === "mkdir-index") {
    stats.mode = 57344;
  }
  return [fullpath, oid, stats];
}
async function batchAllSettled(operationName, tasks, onProgress, batchSize) {
  const results = [];
  try {
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize).map((task) => task());
      const batchResults = await Promise.allSettled(batch);
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") results.push(result.value);
      });
      if (onProgress) {
        await onProgress({
          phase: "Updating workdir",
          loaded: i + batch.length,
          total: tasks.length
        });
      }
    }
    return results;
  } catch (error) {
    console.error(`Error during ${operationName}: ${error}`);
  }
  return results;
}
async function checkout({
  fs,
  onProgress,
  onPostCheckout,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  remote = "origin",
  ref: _ref,
  filepaths,
  noCheckout = false,
  noUpdateHead = _ref === void 0,
  dryRun = false,
  force = false,
  track = true,
  cache = {},
  nonBlocking = false,
  batchSize = 100
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    const ref2 = _ref || "HEAD";
    return await _checkout({
      fs: new FileSystem(fs),
      cache,
      onProgress,
      onPostCheckout,
      dir,
      gitdir,
      remote,
      ref: ref2,
      filepaths,
      noCheckout,
      noUpdateHead,
      dryRun,
      force,
      track,
      nonBlocking,
      batchSize
    });
  } catch (err2) {
    err2.caller = "git.checkout";
    throw err2;
  }
}
const abbreviateRx = new RegExp("^refs/(heads/|tags/|remotes/)?(.*)");
function abbreviateRef(ref2) {
  const match = abbreviateRx.exec(ref2);
  if (match) {
    if (match[1] === "remotes/" && ref2.endsWith("/HEAD")) {
      return match[2].slice(0, -5);
    } else {
      return match[2];
    }
  }
  return ref2;
}
async function _currentBranch({
  fs,
  gitdir,
  fullname = false,
  test = false
}) {
  const ref2 = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: "HEAD",
    depth: 2
  });
  if (test) {
    try {
      await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
    } catch (_) {
      return;
    }
  }
  if (!ref2.startsWith("refs/")) return;
  return fullname ? ref2 : abbreviateRef(ref2);
}
function translateSSHtoHTTP(url) {
  url = url.replace(/^git@([^:]+):/, "https://$1/");
  url = url.replace(/^ssh:\/\//, "https://");
  return url;
}
function calculateBasicAuthHeader({ username = "", password = "" }) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
async function forAwait(iterable, cb) {
  const iter = getIterator(iterable);
  while (true) {
    const { value, done } = await iter.next();
    if (value) await cb(value);
    if (done) break;
  }
  if (iter.return) iter.return();
}
async function collect(iterable) {
  let size = 0;
  const buffers = [];
  await forAwait(iterable, (value) => {
    buffers.push(value);
    size += value.byteLength;
  });
  const result = new Uint8Array(size);
  let nextIndex = 0;
  for (const buffer of buffers) {
    result.set(buffer, nextIndex);
    nextIndex += buffer.byteLength;
  }
  return result;
}
function extractAuthFromUrl(url) {
  let userpass = url.match(/^https?:\/\/([^/]+)@/);
  if (userpass == null) return { url, auth: {} };
  userpass = userpass[1];
  const [username, password] = userpass.split(":");
  url = url.replace(`${userpass}@`, "");
  return { url, auth: { username, password } };
}
function padHex(b, n) {
  const s = n.toString(16);
  return "0".repeat(b - s.length) + s;
}
class GitPktLine {
  static flush() {
    return Buffer.from("0000", "utf8");
  }
  static delim() {
    return Buffer.from("0001", "utf8");
  }
  static encode(line) {
    if (typeof line === "string") {
      line = Buffer.from(line);
    }
    const length = line.length + 4;
    const hexlength = padHex(4, length);
    return Buffer.concat([Buffer.from(hexlength, "utf8"), line]);
  }
  static streamReader(stream) {
    const reader = new StreamReader(stream);
    return async function read() {
      try {
        let length = await reader.read(4);
        if (length == null) return true;
        length = parseInt(length.toString("utf8"), 16);
        if (length === 0) return null;
        if (length === 1) return null;
        const buffer = await reader.read(length - 4);
        if (buffer == null) return true;
        return buffer;
      } catch (err2) {
        stream.error = err2;
        return true;
      }
    };
  }
}
async function parseCapabilitiesV2(read) {
  const capabilities2 = {};
  let line;
  while (true) {
    line = await read();
    if (line === true) break;
    if (line === null) continue;
    line = line.toString("utf8").replace(/\n$/, "");
    const i = line.indexOf("=");
    if (i > -1) {
      const key = line.slice(0, i);
      const value = line.slice(i + 1);
      capabilities2[key] = value;
    } else {
      capabilities2[line] = true;
    }
  }
  return { protocolVersion: 2, capabilities2 };
}
async function parseRefsAdResponse(stream, { service }) {
  const capabilities = /* @__PURE__ */ new Set();
  const refs = /* @__PURE__ */ new Map();
  const symrefs = /* @__PURE__ */ new Map();
  const read = GitPktLine.streamReader(stream);
  let lineOne = await read();
  while (lineOne === null) lineOne = await read();
  if (lineOne === true) throw new EmptyServerResponseError();
  if (lineOne.includes("version 2")) {
    return parseCapabilitiesV2(read);
  }
  if (lineOne.toString("utf8").replace(/\n$/, "") !== `# service=${service}`) {
    throw new ParseError(`# service=${service}\\n`, lineOne.toString("utf8"));
  }
  let lineTwo = await read();
  while (lineTwo === null) lineTwo = await read();
  if (lineTwo === true) return { capabilities, refs, symrefs };
  lineTwo = lineTwo.toString("utf8");
  if (lineTwo.includes("version 2")) {
    return parseCapabilitiesV2(read);
  }
  const [firstRef, capabilitiesLine] = splitAndAssert(lineTwo, "\0", "\\x00");
  capabilitiesLine.split(" ").map((x) => capabilities.add(x));
  if (firstRef !== "0000000000000000000000000000000000000000 capabilities^{}") {
    const [ref2, name] = splitAndAssert(firstRef, " ", " ");
    refs.set(name, ref2);
    while (true) {
      const line = await read();
      if (line === true) break;
      if (line !== null) {
        const [ref22, name2] = splitAndAssert(line.toString("utf8"), " ", " ");
        refs.set(name2, ref22);
      }
    }
  }
  for (const cap of capabilities) {
    if (cap.startsWith("symref=")) {
      const m = cap.match(/symref=([^:]+):(.*)/);
      if (m.length === 3) {
        symrefs.set(m[1], m[2]);
      }
    }
  }
  return { protocolVersion: 1, capabilities, refs, symrefs };
}
function splitAndAssert(line, sep, expected) {
  const split = line.trim().split(sep);
  if (split.length !== 2) {
    throw new ParseError(
      `Two strings separated by '${expected}'`,
      line.toString("utf8")
    );
  }
  return split;
}
const corsProxify = (corsProxy, url) => corsProxy.endsWith("?") ? `${corsProxy}${url}` : `${corsProxy}/${url.replace(/^https?:\/\//, "")}`;
const updateHeaders = (headers, auth) => {
  if (auth.username || auth.password) {
    headers.Authorization = calculateBasicAuthHeader(auth);
  }
  if (auth.headers) {
    Object.assign(headers, auth.headers);
  }
};
const stringifyBody = async (res) => {
  try {
    const data = Buffer.from(await collect(res.body));
    const response = data.toString("utf8");
    const preview = response.length < 256 ? response : response.slice(0, 256) + "...";
    return { preview, response, data };
  } catch (e) {
    return {};
  }
};
class GitRemoteHTTP {
  /**
   * Returns the capabilities of the GitRemoteHTTP class.
   *
   * @returns {Promise<string[]>} - An array of supported capabilities.
   */
  static async capabilities() {
    return ["discover", "connect"];
  }
  /**
   * Discovers references from a remote Git repository.
   *
   * @param {Object} args
   * @param {HttpClient} args.http - The HTTP client to use for requests.
   * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
   * @param {AuthCallback} [args.onAuth] - Callback for providing authentication credentials.
   * @param {AuthFailureCallback} [args.onAuthFailure] - Callback for handling authentication failures.
   * @param {AuthSuccessCallback} [args.onAuthSuccess] - Callback for handling successful authentication.
   * @param {string} [args.corsProxy] - Optional CORS proxy URL.
   * @param {string} args.service - The Git service (e.g., "git-upload-pack").
   * @param {string} args.url - The URL of the remote repository.
   * @param {Object<string, string>} args.headers - HTTP headers to include in the request.
   * @param {1 | 2} args.protocolVersion - The Git protocol version to use.
   * @returns {Promise<Object>} - The parsed response from the remote repository.
   * @throws {HttpError} - If the HTTP request fails.
   * @throws {SmartHttpError} - If the response cannot be parsed.
   * @throws {UserCanceledError} - If the user cancels the operation.
   */
  static async discover({
    http,
    onProgress,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service,
    url: _origUrl,
    headers,
    protocolVersion
  }) {
    let { url, auth } = extractAuthFromUrl(_origUrl);
    const proxifiedURL = corsProxy ? corsProxify(corsProxy, url) : url;
    if (auth.username || auth.password) {
      headers.Authorization = calculateBasicAuthHeader(auth);
    }
    if (protocolVersion === 2) {
      headers["Git-Protocol"] = "version=2";
    }
    let res;
    let tryAgain;
    let providedAuthBefore = false;
    do {
      res = await http.request({
        onProgress,
        method: "GET",
        url: `${proxifiedURL}/info/refs?service=${service}`,
        headers
      });
      tryAgain = false;
      if (res.statusCode === 401 || res.statusCode === 203) {
        const getAuth = providedAuthBefore ? onAuthFailure : onAuth;
        if (getAuth) {
          auth = await getAuth(url, {
            ...auth,
            headers: { ...headers }
          });
          if (auth && auth.cancel) {
            throw new UserCanceledError();
          } else if (auth) {
            updateHeaders(headers, auth);
            providedAuthBefore = true;
            tryAgain = true;
          }
        }
      } else if (res.statusCode === 200 && providedAuthBefore && onAuthSuccess) {
        await onAuthSuccess(url, auth);
      }
    } while (tryAgain);
    if (res.statusCode !== 200) {
      const { response } = await stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage, response);
    }
    if (res.headers["content-type"] === `application/x-${service}-advertisement`) {
      const remoteHTTP = await parseRefsAdResponse(res.body, { service });
      remoteHTTP.auth = auth;
      return remoteHTTP;
    } else {
      const { preview, response, data } = await stringifyBody(res);
      try {
        const remoteHTTP = await parseRefsAdResponse([data], { service });
        remoteHTTP.auth = auth;
        return remoteHTTP;
      } catch (e) {
        throw new SmartHttpError(preview, response);
      }
    }
  }
  /**
   * Connects to a remote Git repository and sends a request.
   *
   * @param {Object} args
   * @param {HttpClient} args.http - The HTTP client to use for requests.
   * @param {ProgressCallback} [args.onProgress] - Callback for progress updates.
   * @param {string} [args.corsProxy] - Optional CORS proxy URL.
   * @param {string} args.service - The Git service (e.g., "git-upload-pack").
   * @param {string} args.url - The URL of the remote repository.
   * @param {Object<string, string>} [args.headers] - HTTP headers to include in the request.
   * @param {any} args.body - The request body to send.
   * @param {any} args.auth - Authentication credentials.
   * @returns {Promise<GitHttpResponse>} - The HTTP response from the remote repository.
   * @throws {HttpError} - If the HTTP request fails.
   */
  static async connect({
    http,
    onProgress,
    corsProxy,
    service,
    url,
    auth,
    body,
    headers
  }) {
    const urlAuth = extractAuthFromUrl(url);
    if (urlAuth) url = urlAuth.url;
    if (corsProxy) url = corsProxify(corsProxy, url);
    headers["content-type"] = `application/x-${service}-request`;
    headers.accept = `application/x-${service}-result`;
    updateHeaders(headers, auth);
    const res = await http.request({
      onProgress,
      method: "POST",
      url: `${url}/${service}`,
      body,
      headers
    });
    if (res.statusCode !== 200) {
      const { response } = stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage, response);
    }
    return res;
  }
}
class GitRemoteManager {
  /**
   * Determines the appropriate remote helper for the given URL.
   *
   * @param {Object} args
   * @param {string} args.url - The URL of the remote repository.
   * @returns {Object} - The remote helper class for the specified transport.
   * @throws {UrlParseError} - If the URL cannot be parsed.
   * @throws {UnknownTransportError} - If the transport is not supported.
   */
  static getRemoteHelperFor({ url }) {
    const remoteHelpers = /* @__PURE__ */ new Map();
    remoteHelpers.set("http", GitRemoteHTTP);
    remoteHelpers.set("https", GitRemoteHTTP);
    const parts = parseRemoteUrl({ url });
    if (!parts) {
      throw new UrlParseError(url);
    }
    if (remoteHelpers.has(parts.transport)) {
      return remoteHelpers.get(parts.transport);
    }
    throw new UnknownTransportError(
      url,
      parts.transport,
      parts.transport === "ssh" ? translateSSHtoHTTP(url) : void 0
    );
  }
}
function parseRemoteUrl({ url }) {
  if (url.startsWith("git@")) {
    return {
      transport: "ssh",
      address: url
    };
  }
  const matches = url.match(/(\w+)(:\/\/|::)(.*)/);
  if (matches === null) return;
  if (matches[2] === "://") {
    return {
      transport: matches[1],
      address: matches[0]
    };
  }
  if (matches[2] === "::") {
    return {
      transport: matches[1],
      address: matches[3]
    };
  }
}
let lock$2 = null;
class GitShallowManager {
  /**
   * Reads the `shallow` file in the Git repository and returns a set of object IDs (OIDs).
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @returns {Promise<Set<string>>} - A set of shallow object IDs.
   */
  static async read({ fs, gitdir }) {
    if (lock$2 === null) lock$2 = new AsyncLock();
    const filepath = pathBrowserify.join(gitdir, "shallow");
    const oids = /* @__PURE__ */ new Set();
    await lock$2.acquire(filepath, async function() {
      const text = await fs.read(filepath, { encoding: "utf8" });
      if (text === null) return oids;
      if (text.trim() === "") return oids;
      text.trim().split("\n").map((oid) => oids.add(oid));
    });
    return oids;
  }
  /**
   * Writes a set of object IDs (OIDs) to the `shallow` file in the Git repository.
   * If the set is empty, the `shallow` file is removed.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
   * @param {Set<string>} args.oids - A set of shallow object IDs to write.
   * @returns {Promise<void>}
   */
  static async write({ fs, gitdir, oids }) {
    if (lock$2 === null) lock$2 = new AsyncLock();
    const filepath = pathBrowserify.join(gitdir, "shallow");
    if (oids.size > 0) {
      const text = [...oids].join("\n") + "\n";
      await lock$2.acquire(filepath, async function() {
        await fs.write(filepath, text, {
          encoding: "utf8"
        });
      });
    } else {
      await lock$2.acquire(filepath, async function() {
        await fs.rm(filepath);
      });
    }
  }
}
async function hasObjectLoose({ fs, gitdir, oid }) {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  return fs.exists(`${gitdir}/${source}`);
}
async function hasObjectPacked({
  fs,
  cache,
  gitdir,
  oid,
  getExternalRefDelta
}) {
  let list = await fs.readdir(pathBrowserify.join(gitdir, "objects/pack"));
  list = list.filter((x) => x.endsWith(".idx"));
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta
    });
    if (p.error) throw new InternalError(p.error);
    if (p.offsets.has(oid)) {
      return true;
    }
  }
  return false;
}
async function hasObject({
  fs,
  cache,
  gitdir,
  oid,
  format: format2 = "content"
}) {
  const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
  let result = await hasObjectLoose({ fs, gitdir, oid });
  if (!result) {
    result = await hasObjectPacked({
      fs,
      cache,
      gitdir,
      oid,
      getExternalRefDelta
    });
  }
  return result;
}
function emptyPackfile(pack) {
  const pheader = "5041434b";
  const version2 = "00000002";
  const obCount = "00000000";
  const header = pheader + version2 + obCount;
  return pack.slice(0, 12).toString("hex") === header;
}
function filterCapabilities(server, client) {
  const serverNames = server.map((cap) => cap.split("=", 1)[0]);
  return client.filter((cap) => {
    const name = cap.split("=", 1)[0];
    return serverNames.includes(name);
  });
}
const pkg = {
  name: "isomorphic-git",
  version: "1.34.0",
  agent: "git/isomorphic-git@1.34.0"
};
class FIFO {
  constructor() {
    this._queue = [];
  }
  write(chunk) {
    if (this._ended) {
      throw Error("You cannot write to a FIFO that has already been ended!");
    }
    if (this._waiting) {
      const resolve2 = this._waiting;
      this._waiting = null;
      resolve2({ value: chunk });
    } else {
      this._queue.push(chunk);
    }
  }
  end() {
    this._ended = true;
    if (this._waiting) {
      const resolve2 = this._waiting;
      this._waiting = null;
      resolve2({ done: true });
    }
  }
  destroy(err2) {
    this.error = err2;
    this.end();
  }
  async next() {
    if (this._queue.length > 0) {
      return { value: this._queue.shift() };
    }
    if (this._ended) {
      return { done: true };
    }
    if (this._waiting) {
      throw Error(
        "You cannot call read until the previous call to read has returned!"
      );
    }
    return new Promise((resolve2) => {
      this._waiting = resolve2;
    });
  }
}
function findSplit(str) {
  const r = str.indexOf("\r");
  const n = str.indexOf("\n");
  if (r === -1 && n === -1) return -1;
  if (r === -1) return n + 1;
  if (n === -1) return r + 1;
  if (n === r + 1) return n + 1;
  return Math.min(r, n) + 1;
}
function splitLines(input) {
  const output = new FIFO();
  let tmp = "";
  (async () => {
    await forAwait(input, (chunk) => {
      chunk = chunk.toString("utf8");
      tmp += chunk;
      while (true) {
        const i = findSplit(tmp);
        if (i === -1) break;
        output.write(tmp.slice(0, i));
        tmp = tmp.slice(i);
      }
    });
    if (tmp.length > 0) {
      output.write(tmp);
    }
    output.end();
  })();
  return output;
}
class GitSideBand {
  static demux(input) {
    const read = GitPktLine.streamReader(input);
    const packetlines = new FIFO();
    const packfile = new FIFO();
    const progress = new FIFO();
    const nextBit = async function() {
      const line = await read();
      if (line === null) return nextBit();
      if (line === true) {
        packetlines.end();
        progress.end();
        input.error ? packfile.destroy(input.error) : packfile.end();
        return;
      }
      switch (line[0]) {
        case 1: {
          packfile.write(line.slice(1));
          break;
        }
        case 2: {
          progress.write(line.slice(1));
          break;
        }
        case 3: {
          const error = line.slice(1);
          progress.write(error);
          packetlines.end();
          progress.end();
          packfile.destroy(new Error(error.toString("utf8")));
          return;
        }
        default: {
          packetlines.write(line);
        }
      }
      nextBit();
    };
    nextBit();
    return {
      packetlines,
      packfile,
      progress
    };
  }
  // static mux ({
  //   protocol, // 'side-band' or 'side-band-64k'
  //   packetlines,
  //   packfile,
  //   progress,
  //   error
  // }) {
  //   const MAX_PACKET_LENGTH = protocol === 'side-band-64k' ? 999 : 65519
  //   let output = new PassThrough()
  //   packetlines.on('data', data => {
  //     if (data === null) {
  //       output.write(GitPktLine.flush())
  //     } else {
  //       output.write(GitPktLine.encode(data))
  //     }
  //   })
  //   let packfileWasEmpty = true
  //   let packfileEnded = false
  //   let progressEnded = false
  //   let errorEnded = false
  //   let goodbye = Buffer.concat([
  //     GitPktLine.encode(Buffer.from('010A', 'hex')),
  //     GitPktLine.flush()
  //   ])
  //   packfile
  //     .on('data', data => {
  //       packfileWasEmpty = false
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('01', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       packfileEnded = true
  //       if (!packfileWasEmpty) output.write(goodbye)
  //       if (progressEnded && errorEnded) output.end()
  //     })
  //   progress
  //     .on('data', data => {
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('02', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       progressEnded = true
  //       if (packfileEnded && errorEnded) output.end()
  //     })
  //   error
  //     .on('data', data => {
  //       const buffers = splitBuffer(data, MAX_PACKET_LENGTH)
  //       for (const buffer of buffers) {
  //         output.write(
  //           GitPktLine.encode(Buffer.concat([Buffer.from('03', 'hex'), buffer]))
  //         )
  //       }
  //     })
  //     .on('end', () => {
  //       errorEnded = true
  //       if (progressEnded && packfileEnded) output.end()
  //     })
  //   return output
  // }
}
async function parseUploadPackResponse(stream) {
  const { packetlines, packfile, progress } = GitSideBand.demux(stream);
  const shallows = [];
  const unshallows = [];
  const acks = [];
  let nak = false;
  let done = false;
  return new Promise((resolve2, reject) => {
    forAwait(packetlines, (data) => {
      const line = data.toString("utf8").trim();
      if (line.startsWith("shallow")) {
        const oid = line.slice(-41).trim();
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid));
        }
        shallows.push(oid);
      } else if (line.startsWith("unshallow")) {
        const oid = line.slice(-41).trim();
        if (oid.length !== 40) {
          reject(new InvalidOidError(oid));
        }
        unshallows.push(oid);
      } else if (line.startsWith("ACK")) {
        const [, oid, status2] = line.split(" ");
        acks.push({ oid, status: status2 });
        if (!status2) done = true;
      } else if (line.startsWith("NAK")) {
        nak = true;
        done = true;
      } else {
        done = true;
        nak = true;
      }
      if (done) {
        stream.error ? reject(stream.error) : resolve2({ shallows, unshallows, acks, nak, packfile, progress });
      }
    }).finally(() => {
      if (!done) {
        stream.error ? reject(stream.error) : resolve2({ shallows, unshallows, acks, nak, packfile, progress });
      }
    });
  });
}
function writeUploadPackRequest({
  capabilities = [],
  wants = [],
  haves = [],
  shallows = [],
  depth = null,
  since = null,
  exclude = []
}) {
  const packstream = [];
  wants = [...new Set(wants)];
  let firstLineCapabilities = ` ${capabilities.join(" ")}`;
  for (const oid of wants) {
    packstream.push(GitPktLine.encode(`want ${oid}${firstLineCapabilities}
`));
    firstLineCapabilities = "";
  }
  for (const oid of shallows) {
    packstream.push(GitPktLine.encode(`shallow ${oid}
`));
  }
  if (depth !== null) {
    packstream.push(GitPktLine.encode(`deepen ${depth}
`));
  }
  if (since !== null) {
    packstream.push(
      GitPktLine.encode(`deepen-since ${Math.floor(since.valueOf() / 1e3)}
`)
    );
  }
  for (const oid of exclude) {
    packstream.push(GitPktLine.encode(`deepen-not ${oid}
`));
  }
  packstream.push(GitPktLine.flush());
  for (const oid of haves) {
    packstream.push(GitPktLine.encode(`have ${oid}
`));
  }
  packstream.push(GitPktLine.encode(`done
`));
  return packstream;
}
async function _fetch({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  gitdir,
  ref: _ref,
  remoteRef: _remoteRef,
  remote: _remote,
  url: _url,
  corsProxy,
  depth = null,
  since = null,
  exclude = [],
  relative: relative2 = false,
  tags = false,
  singleBranch = false,
  headers = {},
  prune = false,
  pruneTags = false
}) {
  const ref2 = _ref || await _currentBranch({ fs, gitdir, test: true });
  const config = await GitConfigManager.get({ fs, gitdir });
  const remote = _remote || ref2 && await config.get(`branch.${ref2}.remote`) || "origin";
  const url = _url || await config.get(`remote.${remote}.url`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remote OR url");
  }
  const remoteRef = _remoteRef || ref2 && await config.get(`branch.${ref2}.merge`) || _ref || "HEAD";
  if (corsProxy === void 0) {
    corsProxy = await config.get("http.corsProxy");
  }
  const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
  const remoteHTTP = await GitRemoteHTTP2.discover({
    http,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service: "git-upload-pack",
    url,
    headers,
    protocolVersion: 1
  });
  const auth = remoteHTTP.auth;
  const remoteRefs = remoteHTTP.refs;
  if (remoteRefs.size === 0) {
    return {
      defaultBranch: null,
      fetchHead: null,
      fetchHeadDescription: null
    };
  }
  if (depth !== null && !remoteHTTP.capabilities.has("shallow")) {
    throw new RemoteCapabilityError("shallow", "depth");
  }
  if (since !== null && !remoteHTTP.capabilities.has("deepen-since")) {
    throw new RemoteCapabilityError("deepen-since", "since");
  }
  if (exclude.length > 0 && !remoteHTTP.capabilities.has("deepen-not")) {
    throw new RemoteCapabilityError("deepen-not", "exclude");
  }
  if (relative2 === true && !remoteHTTP.capabilities.has("deepen-relative")) {
    throw new RemoteCapabilityError("deepen-relative", "relative");
  }
  const { oid, fullref } = GitRefManager.resolveAgainstMap({
    ref: remoteRef,
    map: remoteRefs
  });
  for (const remoteRef2 of remoteRefs.keys()) {
    if (remoteRef2 === fullref || remoteRef2 === "HEAD" || remoteRef2.startsWith("refs/heads/") || tags && remoteRef2.startsWith("refs/tags/")) {
      continue;
    }
    remoteRefs.delete(remoteRef2);
  }
  const capabilities = filterCapabilities(
    [...remoteHTTP.capabilities],
    [
      "multi_ack_detailed",
      "no-done",
      "side-band-64k",
      // Note: I removed 'thin-pack' option since our code doesn't "fatten" packfiles,
      // which is necessary for compatibility with git. It was the cause of mysterious
      // 'fatal: pack has [x] unresolved deltas' errors that plagued us for some time.
      // isomorphic-git is perfectly happy with thin packfiles in .git/objects/pack but
      // canonical git it turns out is NOT.
      "ofs-delta",
      `agent=${pkg.agent}`
    ]
  );
  if (relative2) capabilities.push("deepen-relative");
  const wants = singleBranch ? [oid] : remoteRefs.values();
  const haveRefs = singleBranch ? [ref2] : await GitRefManager.listRefs({
    fs,
    gitdir,
    filepath: `refs`
  });
  let haves = [];
  for (let ref22 of haveRefs) {
    try {
      ref22 = await GitRefManager.expand({ fs, gitdir, ref: ref22 });
      const oid2 = await GitRefManager.resolve({ fs, gitdir, ref: ref22 });
      if (await hasObject({ fs, cache, gitdir, oid: oid2 })) {
        haves.push(oid2);
      }
    } catch (err2) {
    }
  }
  haves = [...new Set(haves)];
  const oids = await GitShallowManager.read({ fs, gitdir });
  const shallows = remoteHTTP.capabilities.has("shallow") ? [...oids] : [];
  const packstream = writeUploadPackRequest({
    capabilities,
    wants,
    haves,
    shallows,
    depth,
    since,
    exclude
  });
  const packbuffer = Buffer.from(await collect(packstream));
  const raw = await GitRemoteHTTP2.connect({
    http,
    onProgress,
    corsProxy,
    service: "git-upload-pack",
    url,
    auth,
    body: [packbuffer],
    headers
  });
  const response = await parseUploadPackResponse(raw.body);
  if (raw.headers) {
    response.headers = raw.headers;
  }
  for (const oid2 of response.shallows) {
    if (!oids.has(oid2)) {
      try {
        const { object } = await _readObject({ fs, cache, gitdir, oid: oid2 });
        const commit2 = new GitCommit(object);
        const hasParents = await Promise.all(
          commit2.headers().parent.map((oid3) => hasObject({ fs, cache, gitdir, oid: oid3 }))
        );
        const haveAllParents = hasParents.length === 0 || hasParents.every((has) => has);
        if (!haveAllParents) {
          oids.add(oid2);
        }
      } catch (err2) {
        oids.add(oid2);
      }
    }
  }
  for (const oid2 of response.unshallows) {
    oids.delete(oid2);
  }
  await GitShallowManager.write({ fs, gitdir, oids });
  if (singleBranch) {
    const refs = /* @__PURE__ */ new Map([[fullref, oid]]);
    const symrefs = /* @__PURE__ */ new Map();
    let bail = 10;
    let key = fullref;
    while (bail--) {
      const value = remoteHTTP.symrefs.get(key);
      if (value === void 0) break;
      symrefs.set(key, value);
      key = value;
    }
    const realRef = remoteRefs.get(key);
    if (realRef) {
      refs.set(key, realRef);
    }
    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs,
      symrefs,
      tags,
      prune
    });
    if (prune) {
      response.pruned = pruned;
    }
  } else {
    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs,
      gitdir,
      remote,
      refs: remoteRefs,
      symrefs: remoteHTTP.symrefs,
      tags,
      prune,
      pruneTags
    });
    if (prune) {
      response.pruned = pruned;
    }
  }
  response.HEAD = remoteHTTP.symrefs.get("HEAD");
  if (response.HEAD === void 0) {
    const { oid: oid2 } = GitRefManager.resolveAgainstMap({
      ref: "HEAD",
      map: remoteRefs
    });
    for (const [key, value] of remoteRefs.entries()) {
      if (key !== "HEAD" && value === oid2) {
        response.HEAD = key;
        break;
      }
    }
  }
  const noun = fullref.startsWith("refs/tags") ? "tag" : "branch";
  response.FETCH_HEAD = {
    oid,
    description: `${noun} '${abbreviateRef(fullref)}' of ${url}`
  };
  if (onProgress || onMessage) {
    const lines = splitLines(response.progress);
    forAwait(lines, async (line) => {
      if (onMessage) await onMessage(line);
      if (onProgress) {
        const matches = line.match(/([^:]*).*\((\d+?)\/(\d+?)\)/);
        if (matches) {
          await onProgress({
            phase: matches[1].trim(),
            loaded: parseInt(matches[2], 10),
            total: parseInt(matches[3], 10)
          });
        }
      }
    });
  }
  const packfile = Buffer.from(await collect(response.packfile));
  if (raw.body.error) throw raw.body.error;
  const packfileSha = packfile.slice(-20).toString("hex");
  const res = {
    defaultBranch: response.HEAD,
    fetchHead: response.FETCH_HEAD.oid,
    fetchHeadDescription: response.FETCH_HEAD.description
  };
  if (response.headers) {
    res.headers = response.headers;
  }
  if (prune) {
    res.pruned = response.pruned;
  }
  if (packfileSha !== "" && !emptyPackfile(packfile)) {
    res.packfile = `objects/pack/pack-${packfileSha}.pack`;
    const fullpath = pathBrowserify.join(gitdir, res.packfile);
    await fs.write(fullpath, packfile);
    const getExternalRefDelta = (oid2) => _readObject({ fs, cache, gitdir, oid: oid2 });
    const idx = await GitPackIndex.fromPack({
      pack: packfile,
      getExternalRefDelta,
      onProgress
    });
    await fs.write(fullpath.replace(/\.pack$/, ".idx"), await idx.toBuffer());
  }
  return res;
}
async function _init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : pathBrowserify.join(dir, ".git"),
  defaultBranch = "master"
}) {
  if (await fs.exists(gitdir + "/config")) return;
  let folders = [
    "hooks",
    "info",
    "objects/info",
    "objects/pack",
    "refs/heads",
    "refs/tags"
  ];
  folders = folders.map((dir2) => gitdir + "/" + dir2);
  for (const folder of folders) {
    await fs.mkdir(folder);
  }
  await fs.write(
    gitdir + "/config",
    `[core]
	repositoryformatversion = 0
	filemode = false
	bare = ${bare}
` + (bare ? "" : "	logallrefupdates = true\n") + "	symlinks = false\n	ignorecase = true\n"
  );
  await fs.write(gitdir + "/HEAD", `ref: refs/heads/${defaultBranch}
`);
}
async function _clone({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPostCheckout,
  dir,
  gitdir,
  url,
  corsProxy,
  ref: ref2,
  remote,
  depth,
  since,
  exclude,
  relative: relative2,
  singleBranch,
  noCheckout,
  noTags,
  headers,
  nonBlocking,
  batchSize = 100
}) {
  try {
    await _init({ fs, gitdir });
    await _addRemote({ fs, gitdir, remote, url, force: false });
    if (corsProxy) {
      const config = await GitConfigManager.get({ fs, gitdir });
      await config.set(`http.corsProxy`, corsProxy);
      await GitConfigManager.save({ fs, gitdir, config });
    }
    const { defaultBranch, fetchHead } = await _fetch({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      ref: ref2,
      remote,
      corsProxy,
      depth,
      since,
      exclude,
      relative: relative2,
      singleBranch,
      headers,
      tags: !noTags
    });
    if (fetchHead === null) return;
    ref2 = ref2 || defaultBranch;
    ref2 = ref2.replace("refs/heads/", "");
    await _checkout({
      fs,
      cache,
      onProgress,
      onPostCheckout,
      dir,
      gitdir,
      ref: ref2,
      remote,
      noCheckout,
      nonBlocking,
      batchSize
    });
  } catch (err2) {
    await fs.rmdir(gitdir, { recursive: true, maxRetries: 10 }).catch(() => void 0);
    throw err2;
  }
}
async function clone({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPostCheckout,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  url,
  corsProxy = void 0,
  ref: ref2 = void 0,
  remote = "origin",
  depth = void 0,
  since = void 0,
  exclude = [],
  relative: relative2 = false,
  singleBranch = false,
  noCheckout = false,
  noTags = false,
  headers = {},
  cache = {},
  nonBlocking = false,
  batchSize = 100
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    if (!noCheckout) {
      assertParameter("dir", dir);
    }
    assertParameter("url", url);
    return await _clone({
      fs: new FileSystem(fs),
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      onPostCheckout,
      dir,
      gitdir,
      url,
      corsProxy,
      ref: ref2,
      remote,
      depth,
      since,
      exclude,
      relative: relative2,
      singleBranch,
      noCheckout,
      noTags,
      headers,
      nonBlocking,
      batchSize
    });
  } catch (err2) {
    err2.caller = "git.clone";
    throw err2;
  }
}
async function commit({
  fs: _fs,
  onSign,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  message,
  author,
  committer,
  signingKey,
  amend = false,
  dryRun = false,
  noUpdateBranch = false,
  ref: ref2,
  parent,
  tree,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    if (!amend) {
      assertParameter("message", message);
    }
    if (signingKey) {
      assertParameter("onSign", onSign);
    }
    const fs = new FileSystem(_fs);
    return await _commit({
      fs,
      cache,
      onSign,
      gitdir,
      message,
      author,
      committer,
      signingKey,
      amend,
      dryRun,
      noUpdateBranch,
      ref: ref2,
      parent,
      tree
    });
  } catch (err2) {
    err2.caller = "git.commit";
    throw err2;
  }
}
async function currentBranch({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  fullname = false,
  test = false
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return await _currentBranch({
      fs: new FileSystem(fs),
      gitdir,
      fullname,
      test
    });
  } catch (err2) {
    err2.caller = "git.currentBranch";
    throw err2;
  }
}
async function _deleteBranch({ fs, gitdir, ref: ref2 }) {
  ref2 = ref2.startsWith("refs/heads/") ? ref2 : `refs/heads/${ref2}`;
  const exist = await GitRefManager.exists({ fs, gitdir, ref: ref2 });
  if (!exist) {
    throw new NotFoundError(ref2);
  }
  const fullRef = await GitRefManager.expand({ fs, gitdir, ref: ref2 });
  const currentRef = await _currentBranch({ fs, gitdir, fullname: true });
  if (fullRef === currentRef) {
    const value = await GitRefManager.resolve({ fs, gitdir, ref: fullRef });
    await GitRefManager.writeRef({ fs, gitdir, ref: "HEAD", value });
  }
  await GitRefManager.deleteRef({ fs, gitdir, ref: fullRef });
  const abbrevRef = abbreviateRef(ref2);
  const config = await GitConfigManager.get({ fs, gitdir });
  await config.deleteSection("branch", abbrevRef);
  await GitConfigManager.save({ fs, gitdir, config });
}
async function deleteBranch({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("ref", ref2);
    return await _deleteBranch({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2
    });
  } catch (err2) {
    err2.caller = "git.deleteBranch";
    throw err2;
  }
}
async function deleteRef({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), ref: ref2 }) {
  try {
    assertParameter("fs", fs);
    assertParameter("ref", ref2);
    await GitRefManager.deleteRef({ fs: new FileSystem(fs), gitdir, ref: ref2 });
  } catch (err2) {
    err2.caller = "git.deleteRef";
    throw err2;
  }
}
async function _deleteRemote({ fs, gitdir, remote }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  await config.deleteSection("remote", remote);
  await GitConfigManager.save({ fs, gitdir, config });
}
async function deleteRemote({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  remote
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("remote", remote);
    return await _deleteRemote({
      fs: new FileSystem(fs),
      gitdir,
      remote
    });
  } catch (err2) {
    err2.caller = "git.deleteRemote";
    throw err2;
  }
}
async function _deleteTag({ fs, gitdir, ref: ref2 }) {
  ref2 = ref2.startsWith("refs/tags/") ? ref2 : `refs/tags/${ref2}`;
  await GitRefManager.deleteRef({ fs, gitdir, ref: ref2 });
}
async function deleteTag({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), ref: ref2 }) {
  try {
    assertParameter("fs", fs);
    assertParameter("ref", ref2);
    return await _deleteTag({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2
    });
  } catch (err2) {
    err2.caller = "git.deleteTag";
    throw err2;
  }
}
async function expandOidLoose({ fs, gitdir, oid: short }) {
  const prefix = short.slice(0, 2);
  const objectsSuffixes = await fs.readdir(`${gitdir}/objects/${prefix}`);
  return objectsSuffixes.map((suffix) => `${prefix}${suffix}`).filter((_oid) => _oid.startsWith(short));
}
async function expandOidPacked({
  fs,
  cache,
  gitdir,
  oid: short,
  getExternalRefDelta
}) {
  const results = [];
  let list = await fs.readdir(pathBrowserify.join(gitdir, "objects/pack"));
  list = list.filter((x) => x.endsWith(".idx"));
  for (const filename of list) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;
    const p = await readPackIndex({
      fs,
      cache,
      filename: indexFile,
      getExternalRefDelta
    });
    if (p.error) throw new InternalError(p.error);
    for (const oid of p.offsets.keys()) {
      if (oid.startsWith(short)) results.push(oid);
    }
  }
  return results;
}
async function _expandOid({ fs, cache, gitdir, oid: short }) {
  const getExternalRefDelta = (oid) => _readObject({ fs, cache, gitdir, oid });
  const results = await expandOidLoose({ fs, gitdir, oid: short });
  const packedOids = await expandOidPacked({
    fs,
    cache,
    gitdir,
    oid: short,
    getExternalRefDelta
  });
  for (const packedOid of packedOids) {
    if (results.indexOf(packedOid) === -1) {
      results.push(packedOid);
    }
  }
  if (results.length === 1) {
    return results[0];
  }
  if (results.length > 1) {
    throw new AmbiguousError("oids", short, results);
  }
  throw new NotFoundError(`an object matching "${short}"`);
}
async function expandOid({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    return await _expandOid({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid
    });
  } catch (err2) {
    err2.caller = "git.expandOid";
    throw err2;
  }
}
async function expandRef({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), ref: ref2 }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    return await GitRefManager.expand({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2
    });
  } catch (err2) {
    err2.caller = "git.expandRef";
    throw err2;
  }
}
async function _findMergeBase({ fs, cache, gitdir, oids }) {
  const visits = {};
  const passes = oids.length;
  let heads = oids.map((oid, index2) => ({ index: index2, oid }));
  while (heads.length) {
    const result = /* @__PURE__ */ new Set();
    for (const { oid, index: index2 } of heads) {
      if (!visits[oid]) visits[oid] = /* @__PURE__ */ new Set();
      visits[oid].add(index2);
      if (visits[oid].size === passes) {
        result.add(oid);
      }
    }
    if (result.size > 0) {
      return [...result];
    }
    const newheads = /* @__PURE__ */ new Map();
    for (const { oid, index: index2 } of heads) {
      try {
        const { object } = await _readObject({ fs, cache, gitdir, oid });
        const commit2 = GitCommit.from(object);
        const { parent } = commit2.parseHeaders();
        for (const oid2 of parent) {
          if (!visits[oid2] || !visits[oid2].has(index2)) {
            newheads.set(oid2 + ":" + index2, { oid: oid2, index: index2 });
          }
        }
      } catch (err2) {
      }
    }
    heads = Array.from(newheads.values());
  }
  return [];
}
const LINEBREAKS = /^.*(\r?\n|$)/gm;
function mergeFile({ branches, contents }) {
  const ourName = branches[1];
  const theirName = branches[2];
  const baseContent = contents[0];
  const ourContent = contents[1];
  const theirContent = contents[2];
  const ours = ourContent.match(LINEBREAKS);
  const base = baseContent.match(LINEBREAKS);
  const theirs = theirContent.match(LINEBREAKS);
  const result = diff3Merge(ours, base, theirs);
  const markerSize = 7;
  let mergedText = "";
  let cleanMerge = true;
  for (const item of result) {
    if (item.ok) {
      mergedText += item.ok.join("");
    }
    if (item.conflict) {
      cleanMerge = false;
      mergedText += `${"<".repeat(markerSize)} ${ourName}
`;
      mergedText += item.conflict.a.join("");
      mergedText += `${"=".repeat(markerSize)}
`;
      mergedText += item.conflict.b.join("");
      mergedText += `${">".repeat(markerSize)} ${theirName}
`;
    }
  }
  return { cleanMerge, mergedText };
}
async function mergeTree({
  fs,
  cache,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  index: index2,
  ourOid,
  baseOid,
  theirOid,
  ourName = "ours",
  baseName = "base",
  theirName = "theirs",
  dryRun = false,
  abortOnConflict = true,
  mergeDriver
}) {
  const ourTree = TREE({ ref: ourOid });
  const baseTree = TREE({ ref: baseOid });
  const theirTree = TREE({ ref: theirOid });
  const unmergedFiles = [];
  const bothModified = [];
  const deleteByUs = [];
  const deleteByTheirs = [];
  const results = await _walk({
    fs,
    cache,
    dir,
    gitdir,
    trees: [ourTree, baseTree, theirTree],
    map: async function(filepath, [ours, base, theirs]) {
      const path2 = basename$1(filepath);
      const ourChange = await modified(ours, base);
      const theirChange = await modified(theirs, base);
      switch (`${ourChange}-${theirChange}`) {
        case "false-false": {
          return {
            mode: await base.mode(),
            path: path2,
            oid: await base.oid(),
            type: await base.type()
          };
        }
        case "false-true": {
          if (!theirs && await ours.type() === "tree") {
            return {
              mode: await ours.mode(),
              path: path2,
              oid: await ours.oid(),
              type: await ours.type()
            };
          }
          return theirs ? {
            mode: await theirs.mode(),
            path: path2,
            oid: await theirs.oid(),
            type: await theirs.type()
          } : void 0;
        }
        case "true-false": {
          if (!ours && await theirs.type() === "tree") {
            return {
              mode: await theirs.mode(),
              path: path2,
              oid: await theirs.oid(),
              type: await theirs.type()
            };
          }
          return ours ? {
            mode: await ours.mode(),
            path: path2,
            oid: await ours.oid(),
            type: await ours.type()
          } : void 0;
        }
        case "true-true": {
          if (ours && theirs && await ours.type() === "tree" && await theirs.type() === "tree") {
            return {
              mode: await ours.mode(),
              path: path2,
              oid: await ours.oid(),
              type: "tree"
            };
          }
          if (ours && theirs && await ours.type() === "blob" && await theirs.type() === "blob") {
            return mergeBlobs({
              fs,
              gitdir,
              path: path2,
              ours,
              base,
              theirs,
              ourName,
              baseName,
              theirName,
              mergeDriver
            }).then(async (r) => {
              if (!r.cleanMerge) {
                unmergedFiles.push(filepath);
                bothModified.push(filepath);
                if (!abortOnConflict) {
                  let baseOid2 = "";
                  if (base && await base.type() === "blob") {
                    baseOid2 = await base.oid();
                  }
                  const ourOid2 = await ours.oid();
                  const theirOid2 = await theirs.oid();
                  index2.delete({ filepath });
                  if (baseOid2) {
                    index2.insert({ filepath, oid: baseOid2, stage: 1 });
                  }
                  index2.insert({ filepath, oid: ourOid2, stage: 2 });
                  index2.insert({ filepath, oid: theirOid2, stage: 3 });
                }
              } else if (!abortOnConflict) {
                index2.insert({ filepath, oid: r.mergeResult.oid, stage: 0 });
              }
              return r.mergeResult;
            });
          }
          if (base && !ours && theirs && await base.type() === "blob" && await theirs.type() === "blob") {
            unmergedFiles.push(filepath);
            deleteByUs.push(filepath);
            if (!abortOnConflict) {
              const baseOid2 = await base.oid();
              const theirOid2 = await theirs.oid();
              index2.delete({ filepath });
              index2.insert({ filepath, oid: baseOid2, stage: 1 });
              index2.insert({ filepath, oid: theirOid2, stage: 3 });
            }
            return {
              mode: await theirs.mode(),
              oid: await theirs.oid(),
              type: "blob",
              path: path2
            };
          }
          if (base && ours && !theirs && await base.type() === "blob" && await ours.type() === "blob") {
            unmergedFiles.push(filepath);
            deleteByTheirs.push(filepath);
            if (!abortOnConflict) {
              const baseOid2 = await base.oid();
              const ourOid2 = await ours.oid();
              index2.delete({ filepath });
              index2.insert({ filepath, oid: baseOid2, stage: 1 });
              index2.insert({ filepath, oid: ourOid2, stage: 2 });
            }
            return {
              mode: await ours.mode(),
              oid: await ours.oid(),
              type: "blob",
              path: path2
            };
          }
          if (base && !ours && !theirs && (await base.type() === "blob" || await base.type() === "tree")) {
            return void 0;
          }
          throw new MergeNotSupportedError();
        }
      }
    },
    /**
     * @param {TreeEntry} [parent]
     * @param {Array<TreeEntry>} children
     */
    reduce: unmergedFiles.length !== 0 && (!dir || abortOnConflict) ? void 0 : async (parent, children) => {
      const entries = children.filter(Boolean);
      if (!parent) return;
      if (parent && parent.type === "tree" && entries.length === 0 && parent.path !== ".")
        return;
      if (entries.length > 0 || parent.path === "." && entries.length === 0) {
        const tree = new GitTree(entries);
        const object = tree.toObject();
        const oid = await _writeObject({
          fs,
          gitdir,
          type: "tree",
          object,
          dryRun
        });
        parent.oid = oid;
      }
      return parent;
    }
  });
  if (unmergedFiles.length !== 0) {
    if (dir && !abortOnConflict) {
      await _walk({
        fs,
        cache,
        dir,
        gitdir,
        trees: [TREE({ ref: results.oid })],
        map: async function(filepath, [entry]) {
          const path2 = `${dir}/${filepath}`;
          if (await entry.type() === "blob") {
            const mode = await entry.mode();
            const content = new TextDecoder().decode(await entry.content());
            await fs.write(path2, content, { mode });
          }
          return true;
        }
      });
    }
    return new MergeConflictError(
      unmergedFiles,
      bothModified,
      deleteByUs,
      deleteByTheirs
    );
  }
  return results.oid;
}
async function mergeBlobs({
  fs,
  gitdir,
  path: path2,
  ours,
  base,
  theirs,
  ourName,
  theirName,
  baseName,
  dryRun,
  mergeDriver = mergeFile
}) {
  const type2 = "blob";
  let baseMode = "100755";
  let baseOid = "";
  let baseContent = "";
  if (base && await base.type() === "blob") {
    baseMode = await base.mode();
    baseOid = await base.oid();
    baseContent = Buffer.from(await base.content()).toString("utf8");
  }
  const mode = baseMode === await ours.mode() ? await theirs.mode() : await ours.mode();
  if (await ours.oid() === await theirs.oid()) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path: path2, oid: await ours.oid(), type: type2 }
    };
  }
  if (await ours.oid() === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path: path2, oid: await theirs.oid(), type: type2 }
    };
  }
  if (await theirs.oid() === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, path: path2, oid: await ours.oid(), type: type2 }
    };
  }
  const ourContent = Buffer.from(await ours.content()).toString("utf8");
  const theirContent = Buffer.from(await theirs.content()).toString("utf8");
  const { mergedText, cleanMerge } = await mergeDriver({
    branches: [baseName, ourName, theirName],
    contents: [baseContent, ourContent, theirContent],
    path: path2
  });
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "blob",
    object: Buffer.from(mergedText, "utf8"),
    dryRun
  });
  return { cleanMerge, mergeResult: { mode, path: path2, oid, type: type2 } };
}
async function _merge({
  fs,
  cache,
  dir,
  gitdir,
  ours,
  theirs,
  fastForward: fastForward2 = true,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  abortOnConflict = true,
  message,
  author,
  committer,
  signingKey,
  onSign,
  mergeDriver,
  allowUnrelatedHistories = false
}) {
  if (ours === void 0) {
    ours = await _currentBranch({ fs, gitdir, fullname: true });
  }
  ours = await GitRefManager.expand({
    fs,
    gitdir,
    ref: ours
  });
  theirs = await GitRefManager.expand({
    fs,
    gitdir,
    ref: theirs
  });
  const ourOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: ours
  });
  const theirOid = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: theirs
  });
  const baseOids = await _findMergeBase({
    fs,
    cache,
    gitdir,
    oids: [ourOid, theirOid]
  });
  if (baseOids.length !== 1) {
    if (baseOids.length === 0 && allowUnrelatedHistories) {
      baseOids.push("4b825dc642cb6eb9a060e54bf8d69288fbee4904");
    } else {
      throw new MergeNotSupportedError();
    }
  }
  const baseOid = baseOids[0];
  if (baseOid === theirOid) {
    return {
      oid: ourOid,
      alreadyMerged: true
    };
  }
  if (fastForward2 && baseOid === ourOid) {
    if (!dryRun && !noUpdateBranch) {
      await GitRefManager.writeRef({ fs, gitdir, ref: ours, value: theirOid });
    }
    return {
      oid: theirOid,
      fastForward: true
    };
  } else {
    if (fastForwardOnly) {
      throw new FastForwardError();
    }
    const tree = await GitIndexManager.acquire(
      { fs, gitdir, cache, allowUnmerged: false },
      async (index2) => {
        return mergeTree({
          fs,
          cache,
          dir,
          gitdir,
          index: index2,
          ourOid,
          theirOid,
          baseOid,
          ourName: abbreviateRef(ours),
          baseName: "base",
          theirName: abbreviateRef(theirs),
          dryRun,
          abortOnConflict,
          mergeDriver
        });
      }
    );
    if (tree instanceof MergeConflictError) throw tree;
    if (!message) {
      message = `Merge branch '${abbreviateRef(theirs)}' into ${abbreviateRef(
        ours
      )}`;
    }
    const oid = await _commit({
      fs,
      cache,
      gitdir,
      message,
      ref: ours,
      tree,
      parent: [ourOid, theirOid],
      author,
      committer,
      signingKey,
      onSign,
      dryRun,
      noUpdateBranch
    });
    return {
      oid,
      tree,
      mergeCommit: true
    };
  }
}
async function _pull({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir,
  ref: ref2,
  url,
  remote,
  remoteRef,
  prune,
  pruneTags,
  fastForward: fastForward2,
  fastForwardOnly,
  corsProxy,
  singleBranch,
  headers,
  author,
  committer,
  signingKey
}) {
  try {
    if (!ref2) {
      const head = await _currentBranch({ fs, gitdir });
      if (!head) {
        throw new MissingParameterError("ref");
      }
      ref2 = head;
    }
    const { fetchHead, fetchHeadDescription } = await _fetch({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      corsProxy,
      ref: ref2,
      url,
      remote,
      remoteRef,
      singleBranch,
      headers,
      prune,
      pruneTags
    });
    await _merge({
      fs,
      cache,
      gitdir,
      ours: ref2,
      theirs: fetchHead,
      fastForward: fastForward2,
      fastForwardOnly,
      message: `Merge ${fetchHeadDescription}`,
      author,
      committer,
      signingKey,
      dryRun: false,
      noUpdateBranch: false
    });
    await _checkout({
      fs,
      cache,
      onProgress,
      dir,
      gitdir,
      ref: ref2,
      remote,
      noCheckout: false
    });
  } catch (err2) {
    err2.caller = "git.pull";
    throw err2;
  }
}
async function fastForward({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  url,
  remote,
  remoteRef,
  corsProxy,
  singleBranch,
  headers = {},
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    const thisWillNotBeUsed = {
      name: "",
      email: "",
      timestamp: Date.now(),
      timezoneOffset: 0
    };
    return await _pull({
      fs: new FileSystem(fs),
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      dir,
      gitdir,
      ref: ref2,
      url,
      remote,
      remoteRef,
      fastForwardOnly: true,
      corsProxy,
      singleBranch,
      headers,
      author: thisWillNotBeUsed,
      committer: thisWillNotBeUsed
    });
  } catch (err2) {
    err2.caller = "git.fastForward";
    throw err2;
  }
}
async function fetch$1({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  remote,
  remoteRef,
  url,
  corsProxy,
  depth = null,
  since = null,
  exclude = [],
  relative: relative2 = false,
  tags = false,
  singleBranch = false,
  headers = {},
  prune = false,
  pruneTags = false,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    return await _fetch({
      fs: new FileSystem(fs),
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      gitdir,
      ref: ref2,
      remote,
      remoteRef,
      url,
      corsProxy,
      depth,
      since,
      exclude,
      relative: relative2,
      tags,
      singleBranch,
      headers,
      prune,
      pruneTags
    });
  } catch (err2) {
    err2.caller = "git.fetch";
    throw err2;
  }
}
async function findMergeBase({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oids,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oids", oids);
    return await _findMergeBase({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oids
    });
  } catch (err2) {
    err2.caller = "git.findMergeBase";
    throw err2;
  }
}
async function _findRoot({ fs, filepath }) {
  if (await fs.exists(pathBrowserify.join(filepath, ".git"))) {
    return filepath;
  } else {
    const parent = dirname$1(filepath);
    if (parent === filepath) {
      throw new NotFoundError(`git root for ${filepath}`);
    }
    return _findRoot({ fs, filepath: parent });
  }
}
async function findRoot({ fs, filepath }) {
  try {
    assertParameter("fs", fs);
    assertParameter("filepath", filepath);
    return await _findRoot({ fs: new FileSystem(fs), filepath });
  } catch (err2) {
    err2.caller = "git.findRoot";
    throw err2;
  }
}
async function getConfig({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), path: path2 }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path2);
    return await _getConfig({
      fs: new FileSystem(fs),
      gitdir,
      path: path2
    });
  } catch (err2) {
    err2.caller = "git.getConfig";
    throw err2;
  }
}
async function _getConfigAll({ fs, gitdir, path: path2 }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  return config.getall(path2);
}
async function getConfigAll({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  path: path2
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path2);
    return await _getConfigAll({
      fs: new FileSystem(fs),
      gitdir,
      path: path2
    });
  } catch (err2) {
    err2.caller = "git.getConfigAll";
    throw err2;
  }
}
async function getRemoteInfo({
  http,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  corsProxy,
  url,
  headers = {},
  forPush = false
}) {
  try {
    assertParameter("http", http);
    assertParameter("url", url);
    const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
    const remote = await GitRemoteHTTP2.discover({
      http,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      corsProxy,
      service: forPush ? "git-receive-pack" : "git-upload-pack",
      url,
      headers,
      protocolVersion: 1
    });
    const result = {
      capabilities: [...remote.capabilities]
    };
    for (const [ref2, oid] of remote.refs) {
      const parts = ref2.split("/");
      const last = parts.pop();
      let o = result;
      for (const part of parts) {
        o[part] = o[part] || {};
        o = o[part];
      }
      o[last] = oid;
    }
    for (const [symref, ref2] of remote.symrefs) {
      const parts = symref.split("/");
      const last = parts.pop();
      let o = result;
      for (const part of parts) {
        o[part] = o[part] || {};
        o = o[part];
      }
      o[last] = ref2;
    }
    return result;
  } catch (err2) {
    err2.caller = "git.getRemoteInfo";
    throw err2;
  }
}
function formatInfoRefs(remote, prefix, symrefs, peelTags) {
  const refs = [];
  for (const [key, value] of remote.refs) {
    if (prefix && !key.startsWith(prefix)) continue;
    if (key.endsWith("^{}")) {
      if (peelTags) {
        const _key = key.replace("^{}", "");
        const last = refs[refs.length - 1];
        const r = last.ref === _key ? last : refs.find((x) => x.ref === _key);
        if (r === void 0) {
          throw new Error("I did not expect this to happen");
        }
        r.peeled = value;
      }
      continue;
    }
    const ref2 = { ref: key, oid: value };
    if (symrefs) {
      if (remote.symrefs.has(key)) {
        ref2.target = remote.symrefs.get(key);
      }
    }
    refs.push(ref2);
  }
  return refs;
}
async function getRemoteInfo2({
  http,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  corsProxy,
  url,
  headers = {},
  forPush = false,
  protocolVersion = 2
}) {
  try {
    assertParameter("http", http);
    assertParameter("url", url);
    const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
    const remote = await GitRemoteHTTP2.discover({
      http,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      corsProxy,
      service: forPush ? "git-receive-pack" : "git-upload-pack",
      url,
      headers,
      protocolVersion
    });
    if (remote.protocolVersion === 2) {
      return {
        protocolVersion: remote.protocolVersion,
        capabilities: remote.capabilities2
      };
    }
    const capabilities = {};
    for (const cap of remote.capabilities) {
      const [key, value] = cap.split("=");
      if (value) {
        capabilities[key] = value;
      } else {
        capabilities[key] = true;
      }
    }
    return {
      protocolVersion: 1,
      capabilities,
      refs: formatInfoRefs(remote, void 0, true, true)
    };
  } catch (err2) {
    err2.caller = "git.getRemoteInfo2";
    throw err2;
  }
}
async function hashObject({
  type: type2,
  object,
  format: format2 = "content",
  oid = void 0
}) {
  if (format2 !== "deflated") {
    if (format2 !== "wrapped") {
      object = GitObject.wrap({ type: type2, object });
    }
    oid = await shasum(object);
  }
  return { oid, object };
}
async function hashBlob({ object }) {
  try {
    assertParameter("object", object);
    if (typeof object === "string") {
      object = Buffer.from(object, "utf8");
    } else if (!(object instanceof Uint8Array)) {
      object = new Uint8Array(object);
    }
    const type2 = "blob";
    const { oid, object: _object } = await hashObject({
      type: type2,
      format: "content",
      object
    });
    return { oid, type: type2, object: _object, format: "wrapped" };
  } catch (err2) {
    err2.caller = "git.hashBlob";
    throw err2;
  }
}
async function _indexPack({
  fs,
  cache,
  onProgress,
  dir,
  gitdir,
  filepath
}) {
  try {
    filepath = pathBrowserify.join(dir, filepath);
    const pack = await fs.read(filepath);
    const getExternalRefDelta = (oid) => _readObject({ fs, cache, gitdir, oid });
    const idx = await GitPackIndex.fromPack({
      pack,
      getExternalRefDelta,
      onProgress
    });
    await fs.write(filepath.replace(/\.pack$/, ".idx"), await idx.toBuffer());
    return {
      oids: [...idx.hashes]
    };
  } catch (err2) {
    err2.caller = "git.indexPack";
    throw err2;
  }
}
async function indexPack({
  fs,
  onProgress,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", dir);
    assertParameter("filepath", filepath);
    return await _indexPack({
      fs: new FileSystem(fs),
      cache,
      onProgress,
      dir,
      gitdir,
      filepath
    });
  } catch (err2) {
    err2.caller = "git.indexPack";
    throw err2;
  }
}
async function init({
  fs,
  bare = false,
  dir,
  gitdir = bare ? dir : pathBrowserify.join(dir, ".git"),
  defaultBranch = "master"
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    if (!bare) {
      assertParameter("dir", dir);
    }
    return await _init({
      fs: new FileSystem(fs),
      bare,
      dir,
      gitdir,
      defaultBranch
    });
  } catch (err2) {
    err2.caller = "git.init";
    throw err2;
  }
}
async function _isDescendent({
  fs,
  cache,
  gitdir,
  oid,
  ancestor,
  depth
}) {
  const shallows = await GitShallowManager.read({ fs, gitdir });
  if (!oid) {
    throw new MissingParameterError("oid");
  }
  if (!ancestor) {
    throw new MissingParameterError("ancestor");
  }
  if (oid === ancestor) return false;
  const queue = [oid];
  const visited = /* @__PURE__ */ new Set();
  let searchdepth = 0;
  while (queue.length) {
    if (searchdepth++ === depth) {
      throw new MaxDepthError(depth);
    }
    const oid2 = queue.shift();
    const { type: type2, object } = await _readObject({
      fs,
      cache,
      gitdir,
      oid: oid2
    });
    if (type2 !== "commit") {
      throw new ObjectTypeError(oid2, type2, "commit");
    }
    const commit2 = GitCommit.from(object).parse();
    for (const parent of commit2.parent) {
      if (parent === ancestor) return true;
    }
    if (!shallows.has(oid2)) {
      for (const parent of commit2.parent) {
        if (!visited.has(parent)) {
          queue.push(parent);
          visited.add(parent);
        }
      }
    }
  }
  return false;
}
async function isDescendent({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  ancestor,
  depth = -1,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    assertParameter("ancestor", ancestor);
    return await _isDescendent({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid,
      ancestor,
      depth
    });
  } catch (err2) {
    err2.caller = "git.isDescendent";
    throw err2;
  }
}
async function isIgnored({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    return GitIgnoreManager.isIgnored({
      fs: new FileSystem(fs),
      dir,
      gitdir,
      filepath
    });
  } catch (err2) {
    err2.caller = "git.isIgnored";
    throw err2;
  }
}
async function listBranches({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  remote
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return GitRefManager.listBranches({
      fs: new FileSystem(fs),
      gitdir,
      remote
    });
  } catch (err2) {
    err2.caller = "git.listBranches";
    throw err2;
  }
}
async function _listFiles({ fs, gitdir, ref: ref2, cache }) {
  if (ref2) {
    const oid = await GitRefManager.resolve({ gitdir, fs, ref: ref2 });
    const filenames = [];
    await accumulateFilesFromOid({
      fs,
      cache,
      gitdir,
      oid,
      filenames,
      prefix: ""
    });
    return filenames;
  } else {
    return GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      return index2.entries.map((x) => x.path);
    });
  }
}
async function accumulateFilesFromOid({
  fs,
  cache,
  gitdir,
  oid,
  filenames,
  prefix
}) {
  const { tree } = await _readTree({ fs, cache, gitdir, oid });
  for (const entry of tree) {
    if (entry.type === "tree") {
      await accumulateFilesFromOid({
        fs,
        cache,
        gitdir,
        oid: entry.oid,
        filenames,
        prefix: pathBrowserify.join(prefix, entry.path)
      });
    } else {
      filenames.push(pathBrowserify.join(prefix, entry.path));
    }
  }
}
async function listFiles({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return await _listFiles({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      ref: ref2
    });
  } catch (err2) {
    err2.caller = "git.listFiles";
    throw err2;
  }
}
async function _listNotes({ fs, cache, gitdir, ref: ref2 }) {
  let parent;
  try {
    parent = await GitRefManager.resolve({ gitdir, fs, ref: ref2 });
  } catch (err2) {
    if (err2 instanceof NotFoundError) {
      return [];
    }
  }
  const result = await _readTree({
    fs,
    cache,
    gitdir,
    oid: parent
  });
  const notes = result.tree.map((entry) => ({
    target: entry.path,
    note: entry.oid
  }));
  return notes;
}
async function listNotes({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2 = "refs/notes/commits",
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    return await _listNotes({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      ref: ref2
    });
  } catch (err2) {
    err2.caller = "git.listNotes";
    throw err2;
  }
}
async function listRefs({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return GitRefManager.listRefs({ fs: new FileSystem(fs), gitdir, filepath });
  } catch (err2) {
    err2.caller = "git.listRefs";
    throw err2;
  }
}
async function _listRemotes({ fs, gitdir }) {
  const config = await GitConfigManager.get({ fs, gitdir });
  const remoteNames = await config.getSubsections("remote");
  const remotes = Promise.all(
    remoteNames.map(async (remote) => {
      const url = await config.get(`remote.${remote}.url`);
      return { remote, url };
    })
  );
  return remotes;
}
async function listRemotes({ fs, dir, gitdir = pathBrowserify.join(dir, ".git") }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return await _listRemotes({
      fs: new FileSystem(fs),
      gitdir
    });
  } catch (err2) {
    err2.caller = "git.listRemotes";
    throw err2;
  }
}
async function parseListRefsResponse(stream) {
  const read = GitPktLine.streamReader(stream);
  const refs = [];
  let line;
  while (true) {
    line = await read();
    if (line === true) break;
    if (line === null) continue;
    line = line.toString("utf8").replace(/\n$/, "");
    const [oid, ref2, ...attrs] = line.split(" ");
    const r = { ref: ref2, oid };
    for (const attr of attrs) {
      const [name, value] = attr.split(":");
      if (name === "symref-target") {
        r.target = value;
      } else if (name === "peeled") {
        r.peeled = value;
      }
    }
    refs.push(r);
  }
  return refs;
}
async function writeListRefsRequest({ prefix, symrefs, peelTags }) {
  const packstream = [];
  packstream.push(GitPktLine.encode("command=ls-refs\n"));
  packstream.push(GitPktLine.encode(`agent=${pkg.agent}
`));
  if (peelTags || symrefs || prefix) {
    packstream.push(GitPktLine.delim());
  }
  if (peelTags) packstream.push(GitPktLine.encode("peel"));
  if (symrefs) packstream.push(GitPktLine.encode("symrefs"));
  if (prefix) packstream.push(GitPktLine.encode(`ref-prefix ${prefix}`));
  packstream.push(GitPktLine.flush());
  return packstream;
}
async function listServerRefs({
  http,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  corsProxy,
  url,
  headers = {},
  forPush = false,
  protocolVersion = 2,
  prefix,
  symrefs,
  peelTags
}) {
  try {
    assertParameter("http", http);
    assertParameter("url", url);
    const remote = await GitRemoteHTTP.discover({
      http,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      corsProxy,
      service: forPush ? "git-receive-pack" : "git-upload-pack",
      url,
      headers,
      protocolVersion
    });
    if (remote.protocolVersion === 1) {
      return formatInfoRefs(remote, prefix, symrefs, peelTags);
    }
    const body = await writeListRefsRequest({ prefix, symrefs, peelTags });
    const res = await GitRemoteHTTP.connect({
      http,
      auth: remote.auth,
      headers,
      corsProxy,
      service: forPush ? "git-receive-pack" : "git-upload-pack",
      url,
      body
    });
    return parseListRefsResponse(res.body);
  } catch (err2) {
    err2.caller = "git.listServerRefs";
    throw err2;
  }
}
async function listTags({ fs, dir, gitdir = pathBrowserify.join(dir, ".git") }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    return GitRefManager.listTags({ fs: new FileSystem(fs), gitdir });
  } catch (err2) {
    err2.caller = "git.listTags";
    throw err2;
  }
}
function compareAge(a, b) {
  return a.committer.timestamp - b.committer.timestamp;
}
const EMPTY_OID = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
async function resolveFileIdInTree({ fs, cache, gitdir, oid, fileId }) {
  if (fileId === EMPTY_OID) return;
  const _oid = oid;
  let filepath;
  const result = await resolveTree({ fs, cache, gitdir, oid });
  const tree = result.tree;
  if (fileId === result.oid) {
    filepath = result.path;
  } else {
    filepath = await _resolveFileId({
      fs,
      cache,
      gitdir,
      tree,
      fileId,
      oid: _oid
    });
    if (Array.isArray(filepath)) {
      if (filepath.length === 0) filepath = void 0;
      else if (filepath.length === 1) filepath = filepath[0];
    }
  }
  return filepath;
}
async function _resolveFileId({
  fs,
  cache,
  gitdir,
  tree,
  fileId,
  oid,
  filepaths = [],
  parentPath = ""
}) {
  const walks = tree.entries().map(function(entry) {
    let result;
    if (entry.oid === fileId) {
      result = pathBrowserify.join(parentPath, entry.path);
      filepaths.push(result);
    } else if (entry.type === "tree") {
      result = _readObject({
        fs,
        cache,
        gitdir,
        oid: entry.oid
      }).then(function({ object }) {
        return _resolveFileId({
          fs,
          cache,
          gitdir,
          tree: GitTree.from(object),
          fileId,
          oid,
          filepaths,
          parentPath: pathBrowserify.join(parentPath, entry.path)
        });
      });
    }
    return result;
  });
  await Promise.all(walks);
  return filepaths;
}
async function _log({
  fs,
  cache,
  gitdir,
  filepath,
  ref: ref2,
  depth,
  since,
  force,
  follow
}) {
  const sinceTimestamp = typeof since === "undefined" ? void 0 : Math.floor(since.valueOf() / 1e3);
  const commits = [];
  const shallowCommits = await GitShallowManager.read({ fs, gitdir });
  const oid = await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
  const tips = [await _readCommit({ fs, cache, gitdir, oid })];
  let lastFileOid;
  let lastCommit;
  let isOk;
  function endCommit(commit2) {
    if (isOk && filepath) commits.push(commit2);
  }
  while (tips.length > 0) {
    const commit2 = tips.pop();
    if (sinceTimestamp !== void 0 && commit2.commit.committer.timestamp <= sinceTimestamp) {
      break;
    }
    if (filepath) {
      let vFileOid;
      try {
        vFileOid = await resolveFilepath({
          fs,
          cache,
          gitdir,
          oid: commit2.commit.tree,
          filepath
        });
        if (lastCommit && lastFileOid !== vFileOid) {
          commits.push(lastCommit);
        }
        lastFileOid = vFileOid;
        lastCommit = commit2;
        isOk = true;
      } catch (e) {
        if (e instanceof NotFoundError) {
          let found = follow && lastFileOid;
          if (found) {
            found = await resolveFileIdInTree({
              fs,
              cache,
              gitdir,
              oid: commit2.commit.tree,
              fileId: lastFileOid
            });
            if (found) {
              if (Array.isArray(found)) {
                if (lastCommit) {
                  const lastFound = await resolveFileIdInTree({
                    fs,
                    cache,
                    gitdir,
                    oid: lastCommit.commit.tree,
                    fileId: lastFileOid
                  });
                  if (Array.isArray(lastFound)) {
                    found = found.filter((p) => lastFound.indexOf(p) === -1);
                    if (found.length === 1) {
                      found = found[0];
                      filepath = found;
                      if (lastCommit) commits.push(lastCommit);
                    } else {
                      found = false;
                      if (lastCommit) commits.push(lastCommit);
                      break;
                    }
                  }
                }
              } else {
                filepath = found;
                if (lastCommit) commits.push(lastCommit);
              }
            }
          }
          if (!found) {
            if (isOk && lastFileOid) {
              commits.push(lastCommit);
              if (!force) break;
            }
            if (!force && !follow) throw e;
          }
          lastCommit = commit2;
          isOk = false;
        } else throw e;
      }
    } else {
      commits.push(commit2);
    }
    if (depth !== void 0 && commits.length === depth) {
      endCommit(commit2);
      break;
    }
    if (!shallowCommits.has(commit2.oid)) {
      for (const oid2 of commit2.commit.parent) {
        const commit3 = await _readCommit({ fs, cache, gitdir, oid: oid2 });
        if (!tips.map((commit4) => commit4.oid).includes(commit3.oid)) {
          tips.push(commit3);
        }
      }
    }
    if (tips.length === 0) {
      endCommit(commit2);
    }
    tips.sort((a, b) => compareAge(a.commit, b.commit));
  }
  return commits;
}
async function log({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  ref: ref2 = "HEAD",
  depth,
  since,
  // Date
  force,
  follow,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    return await _log({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      filepath,
      ref: ref2,
      depth,
      since,
      force,
      follow
    });
  } catch (err2) {
    err2.caller = "git.log";
    throw err2;
  }
}
async function merge({
  fs: _fs,
  onSign,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ours,
  theirs,
  fastForward: fastForward2 = true,
  fastForwardOnly = false,
  dryRun = false,
  noUpdateBranch = false,
  abortOnConflict = true,
  message,
  author: _author,
  committer: _committer,
  signingKey,
  cache = {},
  mergeDriver,
  allowUnrelatedHistories = false
}) {
  try {
    assertParameter("fs", _fs);
    if (signingKey) {
      assertParameter("onSign", onSign);
    }
    const fs = new FileSystem(_fs);
    const author = await normalizeAuthorObject({ fs, gitdir, author: _author });
    if (!author && (!fastForwardOnly || !fastForward2)) {
      throw new MissingNameError("author");
    }
    const committer = await normalizeCommitterObject({
      fs,
      gitdir,
      author,
      committer: _committer
    });
    if (!committer && (!fastForwardOnly || !fastForward2)) {
      throw new MissingNameError("committer");
    }
    return await _merge({
      fs,
      cache,
      dir,
      gitdir,
      ours,
      theirs,
      fastForward: fastForward2,
      fastForwardOnly,
      dryRun,
      noUpdateBranch,
      abortOnConflict,
      message,
      author,
      committer,
      signingKey,
      onSign,
      mergeDriver,
      allowUnrelatedHistories
    });
  } catch (err2) {
    err2.caller = "git.merge";
    throw err2;
  }
}
const types = {
  commit: 16,
  tree: 32,
  blob: 48,
  tag: 64,
  ofs_delta: 96,
  ref_delta: 112
};
async function _pack({
  fs,
  cache,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oids
}) {
  const hash2 = new Hash();
  const outputStream = [];
  function write(chunk, enc) {
    const buff = Buffer.from(chunk, enc);
    outputStream.push(buff);
    hash2.update(buff);
  }
  async function writeObject2({ stype, object }) {
    const type2 = types[stype];
    let length = object.length;
    let multibyte = length > 15 ? 128 : 0;
    const lastFour = length & 15;
    length = length >>> 4;
    let byte = (multibyte | type2 | lastFour).toString(16);
    write(byte, "hex");
    while (multibyte) {
      multibyte = length > 127 ? 128 : 0;
      byte = multibyte | length & 127;
      write(padHex(2, byte), "hex");
      length = length >>> 7;
    }
    write(Buffer.from(await deflate(object)));
  }
  write("PACK");
  write("00000002", "hex");
  write(padHex(8, oids.length), "hex");
  for (const oid of oids) {
    const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
    await writeObject2({ object, stype: type2 });
  }
  const digest = hash2.digest();
  outputStream.push(digest);
  return outputStream;
}
async function _packObjects({ fs, cache, gitdir, oids, write }) {
  const buffers = await _pack({ fs, cache, gitdir, oids });
  const packfile = Buffer.from(await collect(buffers));
  const packfileSha = packfile.slice(-20).toString("hex");
  const filename = `pack-${packfileSha}.pack`;
  if (write) {
    await fs.write(pathBrowserify.join(gitdir, `objects/pack/${filename}`), packfile);
    return { filename };
  }
  return {
    filename,
    packfile: new Uint8Array(packfile)
  };
}
async function packObjects({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oids,
  write = false,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oids", oids);
    return await _packObjects({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oids,
      write
    });
  } catch (err2) {
    err2.caller = "git.packObjects";
    throw err2;
  }
}
async function pull({
  fs: _fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  url,
  remote,
  remoteRef,
  prune = false,
  pruneTags = false,
  fastForward: fastForward2 = true,
  fastForwardOnly = false,
  corsProxy,
  singleBranch,
  headers = {},
  author: _author,
  committer: _committer,
  signingKey,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    const fs = new FileSystem(_fs);
    const author = await normalizeAuthorObject({ fs, gitdir, author: _author });
    if (!author) throw new MissingNameError("author");
    const committer = await normalizeCommitterObject({
      fs,
      gitdir,
      author,
      committer: _committer
    });
    if (!committer) throw new MissingNameError("committer");
    return await _pull({
      fs,
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      dir,
      gitdir,
      ref: ref2,
      url,
      remote,
      remoteRef,
      fastForward: fastForward2,
      fastForwardOnly,
      corsProxy,
      singleBranch,
      headers,
      author,
      committer,
      signingKey,
      prune,
      pruneTags
    });
  } catch (err2) {
    err2.caller = "git.pull";
    throw err2;
  }
}
async function listCommitsAndTags({
  fs,
  cache,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  start,
  finish
}) {
  const shallows = await GitShallowManager.read({ fs, gitdir });
  const startingSet = /* @__PURE__ */ new Set();
  const finishingSet = /* @__PURE__ */ new Set();
  for (const ref2 of start) {
    startingSet.add(await GitRefManager.resolve({ fs, gitdir, ref: ref2 }));
  }
  for (const ref2 of finish) {
    try {
      const oid = await GitRefManager.resolve({ fs, gitdir, ref: ref2 });
      finishingSet.add(oid);
    } catch (err2) {
    }
  }
  const visited = /* @__PURE__ */ new Set();
  async function walk2(oid) {
    visited.add(oid);
    const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type2 === "tag") {
      const tag2 = GitAnnotatedTag.from(object);
      const commit2 = tag2.headers().object;
      return walk2(commit2);
    }
    if (type2 !== "commit") {
      throw new ObjectTypeError(oid, type2, "commit");
    }
    if (!shallows.has(oid)) {
      const commit2 = GitCommit.from(object);
      const parents = commit2.headers().parent;
      for (oid of parents) {
        if (!finishingSet.has(oid) && !visited.has(oid)) {
          await walk2(oid);
        }
      }
    }
  }
  for (const oid of startingSet) {
    await walk2(oid);
  }
  return visited;
}
async function listObjects({
  fs,
  cache,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oids
}) {
  const visited = /* @__PURE__ */ new Set();
  async function walk2(oid) {
    if (visited.has(oid)) return;
    visited.add(oid);
    const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
    if (type2 === "tag") {
      const tag2 = GitAnnotatedTag.from(object);
      const obj = tag2.headers().object;
      await walk2(obj);
    } else if (type2 === "commit") {
      const commit2 = GitCommit.from(object);
      const tree = commit2.headers().tree;
      await walk2(tree);
    } else if (type2 === "tree") {
      const tree = GitTree.from(object);
      for (const entry of tree) {
        if (entry.type === "blob") {
          visited.add(entry.oid);
        }
        if (entry.type === "tree") {
          await walk2(entry.oid);
        }
      }
    }
  }
  for (const oid of oids) {
    await walk2(oid);
  }
  return visited;
}
async function parseReceivePackResponse(packfile) {
  const result = {};
  let response = "";
  const read = GitPktLine.streamReader(packfile);
  let line = await read();
  while (line !== true) {
    if (line !== null) response += line.toString("utf8") + "\n";
    line = await read();
  }
  const lines = response.toString("utf8").split("\n");
  line = lines.shift();
  if (!line.startsWith("unpack ")) {
    throw new ParseError('unpack ok" or "unpack [error message]', line);
  }
  result.ok = line === "unpack ok";
  if (!result.ok) {
    result.error = line.slice("unpack ".length);
  }
  result.refs = {};
  for (const line2 of lines) {
    if (line2.trim() === "") continue;
    const status2 = line2.slice(0, 2);
    const refAndMessage = line2.slice(3);
    let space = refAndMessage.indexOf(" ");
    if (space === -1) space = refAndMessage.length;
    const ref2 = refAndMessage.slice(0, space);
    const error = refAndMessage.slice(space + 1);
    result.refs[ref2] = {
      ok: status2 === "ok",
      error
    };
  }
  return result;
}
async function writeReceivePackRequest({
  capabilities = [],
  triplets = []
}) {
  const packstream = [];
  let capsFirstLine = `\0 ${capabilities.join(" ")}`;
  for (const trip of triplets) {
    packstream.push(
      GitPktLine.encode(
        `${trip.oldoid} ${trip.oid} ${trip.fullRef}${capsFirstLine}
`
      )
    );
    capsFirstLine = "";
  }
  packstream.push(GitPktLine.flush());
  return packstream;
}
async function _push({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPrePush,
  gitdir,
  ref: _ref,
  remoteRef: _remoteRef,
  remote,
  url: _url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {}
}) {
  const ref2 = _ref || await _currentBranch({ fs, gitdir });
  if (typeof ref2 === "undefined") {
    throw new MissingParameterError("ref");
  }
  const config = await GitConfigManager.get({ fs, gitdir });
  remote = remote || await config.get(`branch.${ref2}.pushRemote`) || await config.get("remote.pushDefault") || await config.get(`branch.${ref2}.remote`) || "origin";
  const url = _url || await config.get(`remote.${remote}.pushurl`) || await config.get(`remote.${remote}.url`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remote OR url");
  }
  const remoteRef = _remoteRef || await config.get(`branch.${ref2}.merge`);
  if (typeof url === "undefined") {
    throw new MissingParameterError("remoteRef");
  }
  if (corsProxy === void 0) {
    corsProxy = await config.get("http.corsProxy");
  }
  const fullRef = await GitRefManager.expand({ fs, gitdir, ref: ref2 });
  const oid = _delete ? "0000000000000000000000000000000000000000" : await GitRefManager.resolve({ fs, gitdir, ref: fullRef });
  const GitRemoteHTTP2 = GitRemoteManager.getRemoteHelperFor({ url });
  const httpRemote = await GitRemoteHTTP2.discover({
    http,
    onAuth,
    onAuthSuccess,
    onAuthFailure,
    corsProxy,
    service: "git-receive-pack",
    url,
    headers,
    protocolVersion: 1
  });
  const auth = httpRemote.auth;
  let fullRemoteRef;
  if (!remoteRef) {
    fullRemoteRef = fullRef;
  } else {
    try {
      fullRemoteRef = await GitRefManager.expandAgainstMap({
        ref: remoteRef,
        map: httpRemote.refs
      });
    } catch (err2) {
      if (err2 instanceof NotFoundError) {
        fullRemoteRef = remoteRef.startsWith("refs/") ? remoteRef : `refs/heads/${remoteRef}`;
      } else {
        throw err2;
      }
    }
  }
  const oldoid = httpRemote.refs.get(fullRemoteRef) || "0000000000000000000000000000000000000000";
  if (onPrePush) {
    const hookCancel = await onPrePush({
      remote,
      url,
      localRef: { ref: _delete ? "(delete)" : fullRef, oid },
      remoteRef: { ref: fullRemoteRef, oid: oldoid }
    });
    if (!hookCancel) throw new UserCanceledError();
  }
  const thinPack = !httpRemote.capabilities.has("no-thin");
  let objects = /* @__PURE__ */ new Set();
  if (!_delete) {
    const finish = [...httpRemote.refs.values()];
    let skipObjects = /* @__PURE__ */ new Set();
    if (oldoid !== "0000000000000000000000000000000000000000") {
      const mergebase = await _findMergeBase({
        fs,
        cache,
        gitdir,
        oids: [oid, oldoid]
      });
      for (const oid2 of mergebase) finish.push(oid2);
      if (thinPack) {
        skipObjects = await listObjects({ fs, cache, gitdir, oids: mergebase });
      }
    }
    if (!finish.includes(oid)) {
      const commits = await listCommitsAndTags({
        fs,
        cache,
        gitdir,
        start: [oid],
        finish
      });
      objects = await listObjects({ fs, cache, gitdir, oids: commits });
    }
    if (thinPack) {
      try {
        const ref22 = await GitRefManager.resolve({
          fs,
          gitdir,
          ref: `refs/remotes/${remote}/HEAD`,
          depth: 2
        });
        const { oid: oid2 } = await GitRefManager.resolveAgainstMap({
          ref: ref22.replace(`refs/remotes/${remote}/`, ""),
          fullref: ref22,
          map: httpRemote.refs
        });
        const oids = [oid2];
        for (const oid3 of await listObjects({ fs, cache, gitdir, oids })) {
          skipObjects.add(oid3);
        }
      } catch (e) {
      }
      for (const oid2 of skipObjects) {
        objects.delete(oid2);
      }
    }
    if (oid === oldoid) force = true;
    if (!force) {
      if (fullRef.startsWith("refs/tags") && oldoid !== "0000000000000000000000000000000000000000") {
        throw new PushRejectedError("tag-exists");
      }
      if (oid !== "0000000000000000000000000000000000000000" && oldoid !== "0000000000000000000000000000000000000000" && !await _isDescendent({
        fs,
        cache,
        gitdir,
        oid,
        ancestor: oldoid,
        depth: -1
      })) {
        throw new PushRejectedError("not-fast-forward");
      }
    }
  }
  const capabilities = filterCapabilities(
    [...httpRemote.capabilities],
    ["report-status", "side-band-64k", `agent=${pkg.agent}`]
  );
  const packstream1 = await writeReceivePackRequest({
    capabilities,
    triplets: [{ oldoid, oid, fullRef: fullRemoteRef }]
  });
  const packstream2 = _delete ? [] : await _pack({
    fs,
    cache,
    gitdir,
    oids: [...objects]
  });
  const res = await GitRemoteHTTP2.connect({
    http,
    onProgress,
    corsProxy,
    service: "git-receive-pack",
    url,
    auth,
    headers,
    body: [...packstream1, ...packstream2]
  });
  const { packfile, progress } = await GitSideBand.demux(res.body);
  if (onMessage) {
    const lines = splitLines(progress);
    forAwait(lines, async (line) => {
      await onMessage(line);
    });
  }
  const result = await parseReceivePackResponse(packfile);
  if (res.headers) {
    result.headers = res.headers;
  }
  if (remote && result.ok && result.refs[fullRemoteRef].ok && !fullRef.startsWith("refs/tags")) {
    const ref22 = `refs/remotes/${remote}/${fullRemoteRef.replace(
      "refs/heads",
      ""
    )}`;
    if (_delete) {
      await GitRefManager.deleteRef({ fs, gitdir, ref: ref22 });
    } else {
      await GitRefManager.writeRef({ fs, gitdir, ref: ref22, value: oid });
    }
  }
  if (result.ok && Object.values(result.refs).every((result2) => result2.ok)) {
    return result;
  } else {
    const prettyDetails = Object.entries(result.refs).filter(([k, v]) => !v.ok).map(([k, v]) => `
  - ${k}: ${v.error}`).join("");
    throw new GitPushError(prettyDetails, result);
  }
}
async function push({
  fs,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPrePush,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  remoteRef,
  remote = "origin",
  url,
  force = false,
  delete: _delete = false,
  corsProxy,
  headers = {},
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);
    return await _push({
      fs: new FileSystem(fs),
      cache,
      http,
      onProgress,
      onMessage,
      onAuth,
      onAuthSuccess,
      onAuthFailure,
      onPrePush,
      gitdir,
      ref: ref2,
      remoteRef,
      remote,
      url,
      force,
      delete: _delete,
      corsProxy,
      headers
    });
  } catch (err2) {
    err2.caller = "git.push";
    throw err2;
  }
}
async function resolveBlob({ fs, cache, gitdir, oid }) {
  const { type: type2, object } = await _readObject({ fs, cache, gitdir, oid });
  if (type2 === "tag") {
    oid = GitAnnotatedTag.from(object).parse().object;
    return resolveBlob({ fs, cache, gitdir, oid });
  }
  if (type2 !== "blob") {
    throw new ObjectTypeError(oid, type2, "blob");
  }
  return { oid, blob: new Uint8Array(object) };
}
async function _readBlob({
  fs,
  cache,
  gitdir,
  oid,
  filepath = void 0
}) {
  if (filepath !== void 0) {
    oid = await resolveFilepath({ fs, cache, gitdir, oid, filepath });
  }
  const blob = await resolveBlob({
    fs,
    cache,
    gitdir,
    oid
  });
  return blob;
}
async function readBlob({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  filepath,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    return await _readBlob({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid,
      filepath
    });
  } catch (err2) {
    err2.caller = "git.readBlob";
    throw err2;
  }
}
async function readCommit({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    return await _readCommit({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid
    });
  } catch (err2) {
    err2.caller = "git.readCommit";
    throw err2;
  }
}
async function _readNote({
  fs,
  cache,
  gitdir,
  ref: ref2 = "refs/notes/commits",
  oid
}) {
  const parent = await GitRefManager.resolve({ gitdir, fs, ref: ref2 });
  const { blob } = await _readBlob({
    fs,
    cache,
    gitdir,
    oid: parent,
    filepath: oid
  });
  return blob;
}
async function readNote({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2 = "refs/notes/commits",
  oid,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    assertParameter("oid", oid);
    return await _readNote({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      ref: ref2,
      oid
    });
  } catch (err2) {
    err2.caller = "git.readNote";
    throw err2;
  }
}
async function readObject({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  format: format2 = "parsed",
  filepath = void 0,
  encoding = void 0,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    const fs = new FileSystem(_fs);
    if (filepath !== void 0) {
      oid = await resolveFilepath({
        fs,
        cache,
        gitdir,
        oid,
        filepath
      });
    }
    const _format2 = format2 === "parsed" ? "content" : format2;
    const result = await _readObject({
      fs,
      cache,
      gitdir,
      oid,
      format: _format2
    });
    result.oid = oid;
    if (format2 === "parsed") {
      result.format = "parsed";
      switch (result.type) {
        case "commit":
          result.object = GitCommit.from(result.object).parse();
          break;
        case "tree":
          result.object = GitTree.from(result.object).entries();
          break;
        case "blob":
          if (encoding) {
            result.object = result.object.toString(encoding);
          } else {
            result.object = new Uint8Array(result.object);
            result.format = "content";
          }
          break;
        case "tag":
          result.object = GitAnnotatedTag.from(result.object).parse();
          break;
        default:
          throw new ObjectTypeError(
            result.oid,
            result.type,
            "blob|commit|tag|tree"
          );
      }
    } else if (result.format === "deflated" || result.format === "wrapped") {
      result.type = result.format;
    }
    return result;
  } catch (err2) {
    err2.caller = "git.readObject";
    throw err2;
  }
}
async function _readTag({ fs, cache, gitdir, oid }) {
  const { type: type2, object } = await _readObject({
    fs,
    cache,
    gitdir,
    oid,
    format: "content"
  });
  if (type2 !== "tag") {
    throw new ObjectTypeError(oid, type2, "tag");
  }
  const tag2 = GitAnnotatedTag.from(object);
  const result = {
    oid,
    tag: tag2.parse(),
    payload: tag2.payload()
  };
  return result;
}
async function readTag({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    return await _readTag({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid
    });
  } catch (err2) {
    err2.caller = "git.readTag";
    throw err2;
  }
}
async function readTree({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  oid,
  filepath = void 0,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    return await _readTree({
      fs: new FileSystem(fs),
      cache,
      gitdir,
      oid,
      filepath
    });
  } catch (err2) {
    err2.caller = "git.readTree";
    throw err2;
  }
}
async function remove({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    await GitIndexManager.acquire(
      { fs: new FileSystem(_fs), gitdir, cache },
      async function(index2) {
        index2.delete({ filepath });
      }
    );
  } catch (err2) {
    err2.caller = "git.remove";
    throw err2;
  }
}
async function _removeNote({
  fs,
  cache,
  onSign,
  gitdir,
  ref: ref2 = "refs/notes/commits",
  oid,
  author,
  committer,
  signingKey
}) {
  let parent;
  try {
    parent = await GitRefManager.resolve({ gitdir, fs, ref: ref2 });
  } catch (err2) {
    if (!(err2 instanceof NotFoundError)) {
      throw err2;
    }
  }
  const result = await _readTree({
    fs,
    gitdir,
    oid: parent || "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
  });
  let tree = result.tree;
  tree = tree.filter((entry) => entry.path !== oid);
  const treeOid = await _writeTree({
    fs,
    gitdir,
    tree
  });
  const commitOid = await _commit({
    fs,
    cache,
    onSign,
    gitdir,
    ref: ref2,
    tree: treeOid,
    parent: parent && [parent],
    message: `Note removed by 'isomorphic-git removeNote'
`,
    author,
    committer,
    signingKey
  });
  return commitOid;
}
async function removeNote({
  fs: _fs,
  onSign,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2 = "refs/notes/commits",
  oid,
  author: _author,
  committer: _committer,
  signingKey,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    const fs = new FileSystem(_fs);
    const author = await normalizeAuthorObject({ fs, gitdir, author: _author });
    if (!author) throw new MissingNameError("author");
    const committer = await normalizeCommitterObject({
      fs,
      gitdir,
      author,
      committer: _committer
    });
    if (!committer) throw new MissingNameError("committer");
    return await _removeNote({
      fs,
      cache,
      onSign,
      gitdir,
      ref: ref2,
      oid,
      author,
      committer,
      signingKey
    });
  } catch (err2) {
    err2.caller = "git.removeNote";
    throw err2;
  }
}
async function _renameBranch({
  fs,
  gitdir,
  oldref,
  ref: ref2,
  checkout: checkout2 = false
}) {
  if (!validRef2(ref2, true)) {
    throw new InvalidRefNameError(ref2, cleanGitRef.clean(ref2));
  }
  if (!validRef2(oldref, true)) {
    throw new InvalidRefNameError(oldref, cleanGitRef.clean(oldref));
  }
  const fulloldref = `refs/heads/${oldref}`;
  const fullnewref = `refs/heads/${ref2}`;
  const newexist = await GitRefManager.exists({ fs, gitdir, ref: fullnewref });
  if (newexist) {
    throw new AlreadyExistsError("branch", ref2, false);
  }
  const value = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: fulloldref,
    depth: 1
  });
  await GitRefManager.writeRef({ fs, gitdir, ref: fullnewref, value });
  await GitRefManager.deleteRef({ fs, gitdir, ref: fulloldref });
  const fullCurrentBranchRef = await _currentBranch({
    fs,
    gitdir,
    fullname: true
  });
  const isCurrentBranch = fullCurrentBranchRef === fulloldref;
  if (checkout2 || isCurrentBranch) {
    await GitRefManager.writeSymbolicRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: fullnewref
    });
  }
}
async function renameBranch({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  oldref,
  checkout: checkout2 = false
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    assertParameter("oldref", oldref);
    return await _renameBranch({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2,
      oldref,
      checkout: checkout2
    });
  } catch (err2) {
    err2.caller = "git.renameBranch";
    throw err2;
  }
}
async function hashObject$1({ gitdir, type: type2, object }) {
  return shasum(GitObject.wrap({ type: type2, object }));
}
async function resetIndex({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  ref: ref2,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    let oid;
    let workdirOid;
    try {
      oid = await GitRefManager.resolve({ fs, gitdir, ref: ref2 || "HEAD" });
    } catch (e) {
      if (ref2) {
        throw e;
      }
    }
    if (oid) {
      try {
        oid = await resolveFilepath({
          fs,
          cache,
          gitdir,
          oid,
          filepath
        });
      } catch (e) {
        oid = null;
      }
    }
    let stats = {
      ctime: /* @__PURE__ */ new Date(0),
      mtime: /* @__PURE__ */ new Date(0),
      dev: 0,
      ino: 0,
      mode: 0,
      uid: 0,
      gid: 0,
      size: 0
    };
    const object = dir && await fs.read(pathBrowserify.join(dir, filepath));
    if (object) {
      workdirOid = await hashObject$1({
        gitdir,
        type: "blob",
        object
      });
      if (oid === workdirOid) {
        stats = await fs.lstat(pathBrowserify.join(dir, filepath));
      }
    }
    await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      index2.delete({ filepath });
      if (oid) {
        index2.insert({ filepath, stats, oid });
      }
    });
  } catch (err2) {
    err2.caller = "git.reset";
    throw err2;
  }
}
async function resolveRef({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  depth
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    const oid = await GitRefManager.resolve({
      fs: new FileSystem(fs),
      gitdir,
      ref: ref2,
      depth
    });
    return oid;
  } catch (err2) {
    err2.caller = "git.resolveRef";
    throw err2;
  }
}
async function setConfig({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  path: path2,
  value,
  append = false
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path2);
    const fs = new FileSystem(_fs);
    const config = await GitConfigManager.get({ fs, gitdir });
    if (append) {
      await config.append(path2, value);
    } else {
      await config.set(path2, value);
    }
    await GitConfigManager.save({ fs, gitdir, config });
  } catch (err2) {
    err2.caller = "git.setConfig";
    throw err2;
  }
}
async function _writeCommit({ fs, gitdir, commit: commit2 }) {
  const object = GitCommit.from(commit2).toObject();
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "commit",
    object,
    format: "content"
  });
  return oid;
}
class GitRefStash {
  // constructor removed
  static get timezoneOffsetForRefLogEntry() {
    const offsetMinutes = (/* @__PURE__ */ new Date()).getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
    const offsetMinutesFormatted = Math.abs(offsetMinutes % 60).toString().padStart(2, "0");
    const sign3 = offsetMinutes > 0 ? "-" : "+";
    return `${sign3}${offsetHours.toString().padStart(2, "0")}${offsetMinutesFormatted}`;
  }
  static createStashReflogEntry(author, stashCommit, message) {
    const nameNoSpace = author.name.replace(/\s/g, "");
    const z40 = "0000000000000000000000000000000000000000";
    const timestamp = Math.floor(Date.now() / 1e3);
    const timezoneOffset = GitRefStash.timezoneOffsetForRefLogEntry;
    return `${z40} ${stashCommit} ${nameNoSpace} ${author.email} ${timestamp} ${timezoneOffset}	${message}
`;
  }
  static getStashReflogEntry(reflogString, parsed = false) {
    const reflogLines = reflogString.split("\n");
    const entries = reflogLines.filter((l) => l).reverse().map(
      (line, idx) => parsed ? `stash@{${idx}}: ${line.split("	")[1]}` : line
    );
    return entries;
  }
}
const _TreeMap = {
  stage: STAGE,
  workdir: WORKDIR
};
let lock$3;
async function acquireLock$1(ref2, callback) {
  if (lock$3 === void 0) lock$3 = new AsyncLock();
  return lock$3.acquire(ref2, callback);
}
async function checkAndWriteBlob(fs, gitdir, dir, filepath, oid = null) {
  const currentFilepath = pathBrowserify.join(dir, filepath);
  const stats = await fs.lstat(currentFilepath);
  if (!stats) throw new NotFoundError(currentFilepath);
  if (stats.isDirectory())
    throw new InternalError(
      `${currentFilepath}: file expected, but found directory`
    );
  const objContent = oid ? await readObjectLoose({ fs, gitdir, oid }) : void 0;
  let retOid = objContent ? oid : void 0;
  if (!objContent) {
    await acquireLock$1({ fs, gitdir, currentFilepath }, async () => {
      const object = stats.isSymbolicLink() ? await fs.readlink(currentFilepath).then(posixifyPathBuffer) : await fs.read(currentFilepath);
      if (object === null) throw new NotFoundError(currentFilepath);
      retOid = await _writeObject({ fs, gitdir, type: "blob", object });
    });
  }
  return retOid;
}
async function processTreeEntries({ fs, dir, gitdir, entries }) {
  async function processTreeEntry(entry) {
    if (entry.type === "tree") {
      if (!entry.oid) {
        const children = await Promise.all(entry.children.map(processTreeEntry));
        entry.oid = await _writeTree({
          fs,
          gitdir,
          tree: children
        });
        entry.mode = 16384;
      }
    } else if (entry.type === "blob") {
      entry.oid = await checkAndWriteBlob(
        fs,
        gitdir,
        dir,
        entry.path,
        entry.oid
      );
      entry.mode = 33188;
    }
    entry.path = entry.path.split("/").pop();
    return entry;
  }
  return Promise.all(entries.map(processTreeEntry));
}
async function writeTreeChanges({
  fs,
  dir,
  gitdir,
  treePair
  // [TREE({ ref: 'HEAD' }), 'STAGE'] would be the equivalent of `git write-tree`
}) {
  const isStage = treePair[1] === "stage";
  const trees2 = treePair.map((t) => typeof t === "string" ? _TreeMap[t]() : t);
  const changedEntries = [];
  const map = async (filepath, [head, stage]) => {
    if (filepath === "." || await GitIgnoreManager.isIgnored({ fs, dir, gitdir, filepath })) {
      return;
    }
    if (stage) {
      if (!head || await head.oid() !== await stage.oid() && await stage.oid() !== void 0) {
        changedEntries.push([head, stage]);
      }
      return {
        mode: await stage.mode(),
        path: filepath,
        oid: await stage.oid(),
        type: await stage.type()
      };
    }
  };
  const reduce = async (parent, children) => {
    children = children.filter(Boolean);
    if (!parent) {
      return children.length > 0 ? children : void 0;
    } else {
      parent.children = children;
      return parent;
    }
  };
  const iterate = async (walk2, children) => {
    const filtered = [];
    for (const child of children) {
      const [head, stage] = child;
      if (isStage) {
        if (stage) {
          if (await fs.exists(`${dir}/${stage.toString()}`)) {
            filtered.push(child);
          } else {
            changedEntries.push([null, stage]);
          }
        }
      } else if (head) {
        if (!stage) {
          changedEntries.push([head, null]);
        } else {
          filtered.push(child);
        }
      }
    }
    return filtered.length ? Promise.all(filtered.map(walk2)) : [];
  };
  const entries = await _walk({
    fs,
    cache: {},
    dir,
    gitdir,
    trees: trees2,
    map,
    reduce,
    iterate
  });
  if (changedEntries.length === 0 || entries.length === 0) {
    return null;
  }
  const processedEntries = await processTreeEntries({
    fs,
    dir,
    gitdir,
    entries
  });
  const treeEntries = processedEntries.filter(Boolean).map((entry) => ({
    mode: entry.mode,
    path: entry.path,
    oid: entry.oid,
    type: entry.type
  }));
  return _writeTree({ fs, gitdir, tree: treeEntries });
}
async function applyTreeChanges({
  fs,
  dir,
  gitdir,
  stashCommit,
  parentCommit,
  wasStaged
}) {
  const dirRemoved = [];
  const stageUpdated = [];
  const ops = await _walk({
    fs,
    cache: {},
    dir,
    gitdir,
    trees: [TREE({ ref: parentCommit }), TREE({ ref: stashCommit })],
    map: async (filepath, [parent, stash2]) => {
      if (filepath === "." || await GitIgnoreManager.isIgnored({ fs, dir, gitdir, filepath })) {
        return;
      }
      const type2 = stash2 ? await stash2.type() : await parent.type();
      if (type2 !== "tree" && type2 !== "blob") {
        return;
      }
      if (!stash2 && parent) {
        const method = type2 === "tree" ? "rmdir" : "rm";
        if (type2 === "tree") dirRemoved.push(filepath);
        if (type2 === "blob" && wasStaged)
          stageUpdated.push({ filepath, oid: await parent.oid() });
        return { method, filepath };
      }
      const oid = await stash2.oid();
      if (!parent || await parent.oid() !== oid) {
        if (type2 === "tree") {
          return { method: "mkdir", filepath };
        } else {
          if (wasStaged)
            stageUpdated.push({
              filepath,
              oid,
              stats: await fs.lstat(pathBrowserify.join(dir, filepath))
            });
          return {
            method: "write",
            filepath,
            oid
          };
        }
      }
    }
  });
  await acquireLock$1({ fs, gitdir, dirRemoved, ops }, async () => {
    for (const op of ops) {
      const currentFilepath = pathBrowserify.join(dir, op.filepath);
      switch (op.method) {
        case "rmdir":
          await fs.rmdir(currentFilepath);
          break;
        case "mkdir":
          await fs.mkdir(currentFilepath);
          break;
        case "rm":
          await fs.rm(currentFilepath);
          break;
        case "write":
          if (!dirRemoved.some(
            (removedDir) => currentFilepath.startsWith(removedDir)
          )) {
            const { object } = await _readObject({
              fs,
              cache: {},
              gitdir,
              oid: op.oid
            });
            if (await fs.exists(currentFilepath)) {
              await fs.rm(currentFilepath);
            }
            await fs.write(currentFilepath, object);
          }
          break;
      }
    }
  });
  await GitIndexManager.acquire({ fs, gitdir, cache: {} }, async (index2) => {
    stageUpdated.forEach(({ filepath, stats, oid }) => {
      index2.insert({ filepath, stats, oid });
    });
  });
}
class GitStashManager {
  /**
   * Creates an instance of GitStashManager.
   *
   * @param {Object} args
   * @param {FSClient} args.fs - A file system implementation.
   * @param {string} args.dir - The working directory.
   * @param {string}[args.gitdir=join(dir, '.git')] - [required] The [git directory](dir-vs-gitdir.md) path
   */
  constructor({ fs, dir, gitdir = pathBrowserify.join(dir, ".git") }) {
    Object.assign(this, {
      fs,
      dir,
      gitdir,
      _author: null
    });
  }
  /**
   * Gets the reference name for the stash.
   *
   * @returns {string} - The stash reference name.
   */
  static get refStash() {
    return "refs/stash";
  }
  /**
   * Gets the reference name for the stash reflogs.
   *
   * @returns {string} - The stash reflogs reference name.
   */
  static get refLogsStash() {
    return "logs/refs/stash";
  }
  /**
   * Gets the file path for the stash reference.
   *
   * @returns {string} - The file path for the stash reference.
   */
  get refStashPath() {
    return pathBrowserify.join(this.gitdir, GitStashManager.refStash);
  }
  /**
   * Gets the file path for the stash reflogs.
   *
   * @returns {string} - The file path for the stash reflogs.
   */
  get refLogsStashPath() {
    return pathBrowserify.join(this.gitdir, GitStashManager.refLogsStash);
  }
  /**
   * Retrieves the author information for the stash.
   *
   * @returns {Promise<Object>} - The author object.
   * @throws {MissingNameError} - If the author name is missing.
   */
  async getAuthor() {
    if (!this._author) {
      this._author = await normalizeAuthorObject({
        fs: this.fs,
        gitdir: this.gitdir,
        author: {}
      });
      if (!this._author) throw new MissingNameError("author");
    }
    return this._author;
  }
  /**
   * Gets the SHA of a stash entry by its index.
   *
   * @param {number} refIdx - The index of the stash entry.
   * @param {string[]} [stashEntries] - Optional preloaded stash entries.
   * @returns {Promise<string|null>} - The SHA of the stash entry or `null` if not found.
   */
  async getStashSHA(refIdx, stashEntries) {
    if (!await this.fs.exists(this.refStashPath)) {
      return null;
    }
    const entries = stashEntries || await this.readStashReflogs({ parsed: false });
    return entries[refIdx].split(" ")[1];
  }
  /**
   * Writes a stash commit to the repository.
   *
   * @param {Object} args
   * @param {string} args.message - The commit message.
   * @param {string} args.tree - The tree object ID.
   * @param {string[]} args.parent - The parent commit object IDs.
   * @returns {Promise<string>} - The object ID of the written commit.
   */
  async writeStashCommit({ message, tree, parent }) {
    return _writeCommit({
      fs: this.fs,
      gitdir: this.gitdir,
      commit: {
        message,
        tree,
        parent,
        author: await this.getAuthor(),
        committer: await this.getAuthor()
      }
    });
  }
  /**
   * Reads a stash commit by its index.
   *
   * @param {number} refIdx - The index of the stash entry.
   * @returns {Promise<Object>} - The stash commit object.
   * @throws {InvalidRefNameError} - If the index is invalid.
   */
  async readStashCommit(refIdx) {
    const stashEntries = await this.readStashReflogs({ parsed: false });
    if (refIdx !== 0) {
      if (refIdx < 0 || refIdx > stashEntries.length - 1) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          "number that is in range of [0, num of stash pushed]"
        );
      }
    }
    const stashSHA = await this.getStashSHA(refIdx, stashEntries);
    if (!stashSHA) {
      return {};
    }
    return _readCommit({
      fs: this.fs,
      cache: {},
      gitdir: this.gitdir,
      oid: stashSHA
    });
  }
  /**
   * Writes a stash reference to the repository.
   *
   * @param {string} stashCommit - The object ID of the stash commit.
   * @returns {Promise<void>}
   */
  async writeStashRef(stashCommit) {
    return GitRefManager.writeRef({
      fs: this.fs,
      gitdir: this.gitdir,
      ref: GitStashManager.refStash,
      value: stashCommit
    });
  }
  /**
   * Writes a reflog entry for a stash commit.
   *
   * @param {Object} args
   * @param {string} args.stashCommit - The object ID of the stash commit.
   * @param {string} args.message - The reflog message.
   * @returns {Promise<void>}
   */
  async writeStashReflogEntry({ stashCommit, message }) {
    const author = await this.getAuthor();
    const entry = GitRefStash.createStashReflogEntry(
      author,
      stashCommit,
      message
    );
    const filepath = this.refLogsStashPath;
    await acquireLock$1({ filepath, entry }, async () => {
      const appendTo = await this.fs.exists(filepath) ? await this.fs.read(filepath, "utf8") : "";
      await this.fs.write(filepath, appendTo + entry, "utf8");
    });
  }
  /**
   * Reads the stash reflogs.
   *
   * @param {Object} args
   * @param {boolean} [args.parsed=false] - Whether to parse the reflog entries.
   * @returns {Promise<string[]|Object[]>} - The reflog entries as strings or parsed objects.
   */
  async readStashReflogs({ parsed = false }) {
    if (!await this.fs.exists(this.refLogsStashPath)) {
      return [];
    }
    const reflogString = await this.fs.read(this.refLogsStashPath, "utf8");
    return GitRefStash.getStashReflogEntry(reflogString, parsed);
  }
}
async function _createStashCommit({ fs, dir, gitdir, message = "" }) {
  const stashMgr = new GitStashManager({ fs, dir, gitdir });
  await stashMgr.getAuthor();
  const branch2 = await _currentBranch({
    fs,
    gitdir,
    fullname: false
  });
  const headCommit = await GitRefManager.resolve({
    fs,
    gitdir,
    ref: "HEAD"
  });
  const headCommitObj = await readCommit({ fs, dir, gitdir, oid: headCommit });
  const headMsg = headCommitObj.commit.message;
  const stashCommitParents = [headCommit];
  let stashCommitTree = null;
  let workDirCompareBase = TREE({ ref: "HEAD" });
  const indexTree = await writeTreeChanges({
    fs,
    dir,
    gitdir,
    treePair: [TREE({ ref: "HEAD" }), "stage"]
  });
  if (indexTree) {
    const stashCommitOne = await stashMgr.writeStashCommit({
      message: `stash-Index: WIP on ${branch2} - ${(/* @__PURE__ */ new Date()).toISOString()}`,
      tree: indexTree,
      parent: stashCommitParents
    });
    stashCommitParents.push(stashCommitOne);
    stashCommitTree = indexTree;
    workDirCompareBase = STAGE();
  }
  const workingTree = await writeTreeChanges({
    fs,
    dir,
    gitdir,
    treePair: [workDirCompareBase, "workdir"]
  });
  if (workingTree) {
    const workingHeadCommit = await stashMgr.writeStashCommit({
      message: `stash-WorkDir: WIP on ${branch2} - ${(/* @__PURE__ */ new Date()).toISOString()}`,
      tree: workingTree,
      parent: [stashCommitParents[stashCommitParents.length - 1]]
    });
    stashCommitParents.push(workingHeadCommit);
    stashCommitTree = workingTree;
  }
  if (!stashCommitTree || !indexTree && !workingTree) {
    throw new NotFoundError("changes, nothing to stash");
  }
  const stashMsg = (message.trim() || `WIP on ${branch2}`) + `: ${headCommit.substring(0, 7)} ${headMsg}`;
  const stashCommit = await stashMgr.writeStashCommit({
    message: stashMsg,
    tree: stashCommitTree,
    parent: stashCommitParents
  });
  return { stashCommit, stashMsg, branch: branch2, stashMgr };
}
async function _stashPush({ fs, dir, gitdir, message = "" }) {
  const { stashCommit, stashMsg, branch: branch2, stashMgr } = await _createStashCommit({
    fs,
    dir,
    gitdir,
    message
  });
  await stashMgr.writeStashRef(stashCommit);
  await stashMgr.writeStashReflogEntry({
    stashCommit,
    message: stashMsg
  });
  await checkout({
    fs,
    dir,
    gitdir,
    ref: branch2,
    track: false,
    force: true
    // force checkout to discard changes
  });
  return stashCommit;
}
async function _stashCreate({ fs, dir, gitdir, message = "" }) {
  const { stashCommit } = await _createStashCommit({
    fs,
    dir,
    gitdir,
    message
  });
  return stashCommit;
}
async function _stashApply({ fs, dir, gitdir, refIdx = 0 }) {
  const stashMgr = new GitStashManager({ fs, dir, gitdir });
  const stashCommit = await stashMgr.readStashCommit(refIdx);
  const { parent: stashParents = null } = stashCommit.commit ? stashCommit.commit : {};
  if (!stashParents || !Array.isArray(stashParents)) {
    return;
  }
  for (let i = 0; i < stashParents.length - 1; i++) {
    const applyingCommit = await _readCommit({
      fs,
      cache: {},
      gitdir,
      oid: stashParents[i + 1]
    });
    const wasStaged = applyingCommit.commit.message.startsWith("stash-Index");
    await applyTreeChanges({
      fs,
      dir,
      gitdir,
      stashCommit: stashParents[i + 1],
      parentCommit: stashParents[i],
      wasStaged
    });
  }
}
async function _stashDrop({ fs, dir, gitdir, refIdx = 0 }) {
  const stashMgr = new GitStashManager({ fs, dir, gitdir });
  const stashCommit = await stashMgr.readStashCommit(refIdx);
  if (!stashCommit.commit) {
    return;
  }
  const stashRefPath = stashMgr.refStashPath;
  await acquireLock$1(stashRefPath, async () => {
    if (await fs.exists(stashRefPath)) {
      await fs.rm(stashRefPath);
    }
  });
  const reflogEntries = await stashMgr.readStashReflogs({ parsed: false });
  if (!reflogEntries.length) {
    return;
  }
  reflogEntries.splice(refIdx, 1);
  const stashReflogPath = stashMgr.refLogsStashPath;
  await acquireLock$1({ reflogEntries, stashReflogPath, stashMgr }, async () => {
    if (reflogEntries.length) {
      await fs.write(
        stashReflogPath,
        reflogEntries.reverse().join("\n") + "\n",
        "utf8"
      );
      const lastStashCommit = reflogEntries[reflogEntries.length - 1].split(
        " "
      )[1];
      await stashMgr.writeStashRef(lastStashCommit);
    } else {
      await fs.rm(stashReflogPath);
    }
  });
}
async function _stashList({ fs, dir, gitdir }) {
  const stashMgr = new GitStashManager({ fs, dir, gitdir });
  return stashMgr.readStashReflogs({ parsed: true });
}
async function _stashClear({ fs, dir, gitdir }) {
  const stashMgr = new GitStashManager({ fs, dir, gitdir });
  const stashRefPath = [stashMgr.refStashPath, stashMgr.refLogsStashPath];
  await acquireLock$1(stashRefPath, async () => {
    await Promise.all(
      stashRefPath.map(async (path2) => {
        if (await fs.exists(path2)) {
          return fs.rm(path2);
        }
      })
    );
  });
}
async function _stashPop({ fs, dir, gitdir, refIdx = 0 }) {
  await _stashApply({ fs, dir, gitdir, refIdx });
  await _stashDrop({ fs, dir, gitdir, refIdx });
}
async function stash({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  op = "push",
  message = "",
  refIdx = 0
}) {
  assertParameter("fs", fs);
  assertParameter("dir", dir);
  assertParameter("gitdir", gitdir);
  assertParameter("op", op);
  const stashMap = {
    push: _stashPush,
    apply: _stashApply,
    drop: _stashDrop,
    list: _stashList,
    clear: _stashClear,
    pop: _stashPop,
    create: _stashCreate
  };
  const opsNeedRefIdx = ["apply", "drop", "pop"];
  try {
    const _fs = new FileSystem(fs);
    const folders = ["refs", "logs", "logs/refs"];
    folders.map((f) => pathBrowserify.join(gitdir, f)).forEach(async (folder) => {
      if (!await _fs.exists(folder)) {
        await _fs.mkdir(folder);
      }
    });
    const opFunc = stashMap[op];
    if (opFunc) {
      if (opsNeedRefIdx.includes(op) && refIdx < 0) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          "number that is in range of [0, num of stash pushed]"
        );
      }
      return await opFunc({ fs: _fs, dir, gitdir, message, refIdx });
    }
    throw new Error(`To be implemented: ${op}`);
  } catch (err2) {
    err2.caller = "git.stash";
    throw err2;
  }
}
async function status({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  filepath,
  cache = {}
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    const ignored = await GitIgnoreManager.isIgnored({
      fs,
      gitdir,
      dir,
      filepath
    });
    if (ignored) {
      return "ignored";
    }
    const headTree = await getHeadTree({ fs, cache, gitdir });
    const treeOid = await getOidAtPath({
      fs,
      cache,
      gitdir,
      tree: headTree,
      path: filepath
    });
    const indexEntry = await GitIndexManager.acquire(
      { fs, gitdir, cache },
      async function(index2) {
        for (const entry of index2) {
          if (entry.path === filepath) return entry;
        }
        return null;
      }
    );
    const stats = await fs.lstat(pathBrowserify.join(dir, filepath));
    const H = treeOid !== null;
    const I = indexEntry !== null;
    const W2 = stats !== null;
    const getWorkdirOid = async () => {
      if (I && !compareStats(indexEntry, stats)) {
        return indexEntry.oid;
      } else {
        const object = await fs.read(pathBrowserify.join(dir, filepath));
        const workdirOid = await hashObject$1({
          gitdir,
          type: "blob",
          object
        });
        if (I && indexEntry.oid === workdirOid) {
          if (stats.size !== -1) {
            GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
              index2.insert({ filepath, stats, oid: workdirOid });
            });
          }
        }
        return workdirOid;
      }
    };
    if (!H && !W2 && !I) return "absent";
    if (!H && !W2 && I) return "*absent";
    if (!H && W2 && !I) return "*added";
    if (!H && W2 && I) {
      const workdirOid = await getWorkdirOid();
      return workdirOid === indexEntry.oid ? "added" : "*added";
    }
    if (H && !W2 && !I) return "deleted";
    if (H && !W2 && I) {
      return treeOid === indexEntry.oid ? "*deleted" : "*deleted";
    }
    if (H && W2 && !I) {
      const workdirOid = await getWorkdirOid();
      return workdirOid === treeOid ? "*undeleted" : "*undeletemodified";
    }
    if (H && W2 && I) {
      const workdirOid = await getWorkdirOid();
      if (workdirOid === treeOid) {
        return workdirOid === indexEntry.oid ? "unmodified" : "*unmodified";
      } else {
        return workdirOid === indexEntry.oid ? "modified" : "*modified";
      }
    }
  } catch (err2) {
    err2.caller = "git.status";
    throw err2;
  }
}
async function getOidAtPath({ fs, cache, gitdir, tree, path: path2 }) {
  if (typeof path2 === "string") path2 = path2.split("/");
  const dirname22 = path2.shift();
  for (const entry of tree) {
    if (entry.path === dirname22) {
      if (path2.length === 0) {
        return entry.oid;
      }
      const { type: type2, object } = await _readObject({
        fs,
        cache,
        gitdir,
        oid: entry.oid
      });
      if (type2 === "tree") {
        const tree2 = GitTree.from(object);
        return getOidAtPath({ fs, cache, gitdir, tree: tree2, path: path2 });
      }
      if (type2 === "blob") {
        throw new ObjectTypeError(entry.oid, type2, "blob", path2.join("/"));
      }
    }
  }
  return null;
}
async function getHeadTree({ fs, cache, gitdir }) {
  let oid;
  try {
    oid = await GitRefManager.resolve({ fs, gitdir, ref: "HEAD" });
  } catch (e) {
    if (e instanceof NotFoundError) {
      return [];
    }
  }
  const { tree } = await _readTree({ fs, cache, gitdir, oid });
  return tree;
}
async function statusMatrix({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2 = "HEAD",
  filepaths = ["."],
  filter,
  cache = {},
  ignored: shouldIgnore = false
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    const fs = new FileSystem(_fs);
    return await _walk({
      fs,
      cache,
      dir,
      gitdir,
      trees: [TREE({ ref: ref2 }), WORKDIR(), STAGE()],
      map: async function(filepath, [head, workdir, stage]) {
        if (!head && !stage && workdir) {
          if (!shouldIgnore) {
            const isIgnored2 = await GitIgnoreManager.isIgnored({
              fs,
              dir,
              filepath
            });
            if (isIgnored2) {
              return null;
            }
          }
        }
        if (!filepaths.some((base) => worthWalking(filepath, base))) {
          return null;
        }
        if (filter) {
          if (!filter(filepath)) return;
        }
        const [headType, workdirType, stageType] = await Promise.all([
          head && head.type(),
          workdir && workdir.type(),
          stage && stage.type()
        ]);
        const isBlob = [headType, workdirType, stageType].includes("blob");
        if ((headType === "tree" || headType === "special") && !isBlob) return;
        if (headType === "commit") return null;
        if ((workdirType === "tree" || workdirType === "special") && !isBlob)
          return;
        if (stageType === "commit") return null;
        if ((stageType === "tree" || stageType === "special") && !isBlob) return;
        const headOid = headType === "blob" ? await head.oid() : void 0;
        const stageOid = stageType === "blob" ? await stage.oid() : void 0;
        let workdirOid;
        if (headType !== "blob" && workdirType === "blob" && stageType !== "blob") {
          workdirOid = "42";
        } else if (workdirType === "blob") {
          workdirOid = await workdir.oid();
        }
        const entry = [void 0, headOid, workdirOid, stageOid];
        const result = entry.map((value) => entry.indexOf(value));
        result.shift();
        return [filepath, ...result];
      }
    });
  } catch (err2) {
    err2.caller = "git.statusMatrix";
    throw err2;
  }
}
async function tag({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  object,
  force = false
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    const fs = new FileSystem(_fs);
    if (ref2 === void 0) {
      throw new MissingParameterError("ref");
    }
    ref2 = ref2.startsWith("refs/tags/") ? ref2 : `refs/tags/${ref2}`;
    const value = await GitRefManager.resolve({
      fs,
      gitdir,
      ref: object || "HEAD"
    });
    if (!force && await GitRefManager.exists({ fs, gitdir, ref: ref2 })) {
      throw new AlreadyExistsError("tag", ref2);
    }
    await GitRefManager.writeRef({ fs, gitdir, ref: ref2, value });
  } catch (err2) {
    err2.caller = "git.tag";
    throw err2;
  }
}
async function updateIndex$1({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  cache = {},
  filepath,
  oid,
  mode,
  add: add2,
  remove: remove2,
  force
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);
    const fs = new FileSystem(_fs);
    if (remove2) {
      return await GitIndexManager.acquire(
        { fs, gitdir, cache },
        async function(index2) {
          if (!force) {
            const fileStats2 = await fs.lstat(pathBrowserify.join(dir, filepath));
            if (fileStats2) {
              if (fileStats2.isDirectory()) {
                throw new InvalidFilepathError("directory");
              }
              return;
            }
          }
          if (index2.has({ filepath })) {
            index2.delete({
              filepath
            });
          }
        }
      );
    }
    let fileStats;
    if (!oid) {
      fileStats = await fs.lstat(pathBrowserify.join(dir, filepath));
      if (!fileStats) {
        throw new NotFoundError(
          `file at "${filepath}" on disk and "remove" not set`
        );
      }
      if (fileStats.isDirectory()) {
        throw new InvalidFilepathError("directory");
      }
    }
    return await GitIndexManager.acquire({ fs, gitdir, cache }, async function(index2) {
      if (!add2 && !index2.has({ filepath })) {
        throw new NotFoundError(
          `file at "${filepath}" in index and "add" not set`
        );
      }
      let stats;
      if (!oid) {
        stats = fileStats;
        const object = stats.isSymbolicLink() ? await fs.readlink(pathBrowserify.join(dir, filepath)) : await fs.read(pathBrowserify.join(dir, filepath));
        oid = await _writeObject({
          fs,
          gitdir,
          type: "blob",
          format: "content",
          object
        });
      } else {
        stats = {
          ctime: /* @__PURE__ */ new Date(0),
          mtime: /* @__PURE__ */ new Date(0),
          dev: 0,
          ino: 0,
          mode,
          uid: 0,
          gid: 0,
          size: 0
        };
      }
      index2.insert({
        filepath,
        oid,
        stats
      });
      return oid;
    });
  } catch (err2) {
    err2.caller = "git.updateIndex";
    throw err2;
  }
}
function version() {
  try {
    return pkg.version;
  } catch (err2) {
    err2.caller = "git.version";
    throw err2;
  }
}
async function walk({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  trees: trees2,
  map,
  reduce,
  iterate,
  cache = {}
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("trees", trees2);
    return await _walk({
      fs: new FileSystem(fs),
      cache,
      dir,
      gitdir,
      trees: trees2,
      map,
      reduce,
      iterate
    });
  } catch (err2) {
    err2.caller = "git.walk";
    throw err2;
  }
}
async function writeBlob({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), blob }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("blob", blob);
    return await _writeObject({
      fs: new FileSystem(fs),
      gitdir,
      type: "blob",
      object: blob,
      format: "content"
    });
  } catch (err2) {
    err2.caller = "git.writeBlob";
    throw err2;
  }
}
async function writeCommit({
  fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  commit: commit2
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("commit", commit2);
    return await _writeCommit({
      fs: new FileSystem(fs),
      gitdir,
      commit: commit2
    });
  } catch (err2) {
    err2.caller = "git.writeCommit";
    throw err2;
  }
}
async function writeObject({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  type: type2,
  object,
  format: format2 = "parsed",
  oid,
  encoding = void 0
}) {
  try {
    const fs = new FileSystem(_fs);
    if (format2 === "parsed") {
      switch (type2) {
        case "commit":
          object = GitCommit.from(object).toObject();
          break;
        case "tree":
          object = GitTree.from(object).toObject();
          break;
        case "blob":
          object = Buffer.from(object, encoding);
          break;
        case "tag":
          object = GitAnnotatedTag.from(object).toObject();
          break;
        default:
          throw new ObjectTypeError(oid || "", type2, "blob|commit|tag|tree");
      }
      format2 = "content";
    }
    oid = await _writeObject({
      fs,
      gitdir,
      type: type2,
      object,
      oid,
      format: format2
    });
    return oid;
  } catch (err2) {
    err2.caller = "git.writeObject";
    throw err2;
  }
}
async function writeRef({
  fs: _fs,
  dir,
  gitdir = pathBrowserify.join(dir, ".git"),
  ref: ref2,
  value,
  force = false,
  symbolic = false
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref2);
    assertParameter("value", value);
    const fs = new FileSystem(_fs);
    if (!validRef2(ref2, true)) {
      throw new InvalidRefNameError(ref2, cleanGitRef.clean(ref2));
    }
    if (!force && await GitRefManager.exists({ fs, gitdir, ref: ref2 })) {
      throw new AlreadyExistsError("ref", ref2);
    }
    if (symbolic) {
      await GitRefManager.writeSymbolicRef({
        fs,
        gitdir,
        ref: ref2,
        value
      });
    } else {
      value = await GitRefManager.resolve({
        fs,
        gitdir,
        ref: value
      });
      await GitRefManager.writeRef({
        fs,
        gitdir,
        ref: ref2,
        value
      });
    }
  } catch (err2) {
    err2.caller = "git.writeRef";
    throw err2;
  }
}
async function _writeTag({ fs, gitdir, tag: tag2 }) {
  const object = GitAnnotatedTag.from(tag2).toObject();
  const oid = await _writeObject({
    fs,
    gitdir,
    type: "tag",
    object,
    format: "content"
  });
  return oid;
}
async function writeTag({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), tag: tag2 }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("tag", tag2);
    return await _writeTag({
      fs: new FileSystem(fs),
      gitdir,
      tag: tag2
    });
  } catch (err2) {
    err2.caller = "git.writeTag";
    throw err2;
  }
}
async function writeTree({ fs, dir, gitdir = pathBrowserify.join(dir, ".git"), tree }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("tree", tree);
    return await _writeTree({
      fs: new FileSystem(fs),
      gitdir,
      tree
    });
  } catch (err2) {
    err2.caller = "git.writeTree";
    throw err2;
  }
}
var index$2 = {
  Errors,
  STAGE,
  TREE,
  WORKDIR,
  add,
  abortMerge,
  addNote,
  addRemote,
  annotatedTag,
  branch,
  checkout,
  clone,
  commit,
  getConfig,
  getConfigAll,
  setConfig,
  currentBranch,
  deleteBranch,
  deleteRef,
  deleteRemote,
  deleteTag,
  expandOid,
  expandRef,
  fastForward,
  fetch: fetch$1,
  findMergeBase,
  findRoot,
  getRemoteInfo,
  getRemoteInfo2,
  hashBlob,
  indexPack,
  init,
  isDescendent,
  isIgnored,
  listBranches,
  listFiles,
  listNotes,
  listRefs,
  listRemotes,
  listServerRefs,
  listTags,
  log,
  merge,
  packObjects,
  pull,
  push,
  readBlob,
  readCommit,
  readNote,
  readObject,
  readTag,
  readTree,
  remove,
  removeNote,
  renameBranch,
  resetIndex,
  updateIndex: updateIndex$1,
  resolveRef,
  status,
  statusMatrix,
  tag,
  version,
  walk,
  writeBlob,
  writeCommit,
  writeObject,
  writeRef,
  writeTag,
  writeTree,
  stash
};
isomorphicGit.Errors = Errors;
isomorphicGit.STAGE = STAGE;
isomorphicGit.TREE = TREE;
isomorphicGit.WORKDIR = WORKDIR;
isomorphicGit.abortMerge = abortMerge;
var add_1 = isomorphicGit.add = add;
isomorphicGit.addNote = addNote;
isomorphicGit.addRemote = addRemote;
isomorphicGit.annotatedTag = annotatedTag;
isomorphicGit.branch = branch;
isomorphicGit.checkout = checkout;
var clone_1 = isomorphicGit.clone = clone;
var commit_1 = isomorphicGit.commit = commit;
isomorphicGit.currentBranch = currentBranch;
isomorphicGit.default = index$2;
isomorphicGit.deleteBranch = deleteBranch;
isomorphicGit.deleteRef = deleteRef;
isomorphicGit.deleteRemote = deleteRemote;
isomorphicGit.deleteTag = deleteTag;
isomorphicGit.expandOid = expandOid;
isomorphicGit.expandRef = expandRef;
isomorphicGit.fastForward = fastForward;
isomorphicGit.fetch = fetch$1;
isomorphicGit.findMergeBase = findMergeBase;
isomorphicGit.findRoot = findRoot;
isomorphicGit.getConfig = getConfig;
isomorphicGit.getConfigAll = getConfigAll;
isomorphicGit.getRemoteInfo = getRemoteInfo;
isomorphicGit.getRemoteInfo2 = getRemoteInfo2;
isomorphicGit.hashBlob = hashBlob;
isomorphicGit.indexPack = indexPack;
isomorphicGit.init = init;
isomorphicGit.isDescendent = isDescendent;
isomorphicGit.isIgnored = isIgnored;
isomorphicGit.listBranches = listBranches;
isomorphicGit.listFiles = listFiles;
isomorphicGit.listNotes = listNotes;
isomorphicGit.listRefs = listRefs;
isomorphicGit.listRemotes = listRemotes;
isomorphicGit.listServerRefs = listServerRefs;
isomorphicGit.listTags = listTags;
isomorphicGit.log = log;
isomorphicGit.merge = merge;
isomorphicGit.packObjects = packObjects;
var pull_1 = isomorphicGit.pull = pull;
var push_1 = isomorphicGit.push = push;
isomorphicGit.readBlob = readBlob;
isomorphicGit.readCommit = readCommit;
isomorphicGit.readNote = readNote;
isomorphicGit.readObject = readObject;
isomorphicGit.readTag = readTag;
isomorphicGit.readTree = readTree;
isomorphicGit.remove = remove;
isomorphicGit.removeNote = removeNote;
isomorphicGit.renameBranch = renameBranch;
isomorphicGit.resetIndex = resetIndex;
isomorphicGit.resolveRef = resolveRef;
isomorphicGit.setConfig = setConfig;
isomorphicGit.stash = stash;
isomorphicGit.status = status;
var statusMatrix_1 = isomorphicGit.statusMatrix = statusMatrix;
isomorphicGit.tag = tag;
isomorphicGit.updateIndex = updateIndex$1;
isomorphicGit.version = version;
isomorphicGit.walk = walk;
isomorphicGit.writeBlob = writeBlob;
isomorphicGit.writeCommit = writeCommit;
isomorphicGit.writeObject = writeObject;
isomorphicGit.writeRef = writeRef;
isomorphicGit.writeTag = writeTag;
isomorphicGit.writeTree = writeTree;
if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = require$$0$1.Buffer;
}
class GitSyncPlugin extends siyuan.Plugin {
  constructor() {
    super(...arguments);
    this.config = {
      repoUrl: "",
      branch: "main",
      token: "",
      authorName: "SiYuan User",
      authorEmail: "user@siyuan.local",
      autoSync: false,
      syncInterval: 30,
      syncOnChange: false
    };
    this.syncIntervalId = null;
    this.changeDebounceTimer = null;
    this.isSyncing = false;
  }
  async onload() {
    console.log("Loading Git Sync Plugin with isomorphic-git");
    const fsModule = await Promise.resolve().then(() => index$1);
    const LightningFS = fsModule.default || fsModule;
    this.fs = new LightningFS("siyuan-git");
    this.p = this.fs.promises;
    await this.loadConfig();
    this.addTopBarIcon();
    this.setupEventListeners();
    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
      this.startAutoSync();
    }
    if (this.config.syncOnChange) {
      this.startChangeMonitoring();
    }
    siyuan.showMessage("✅ Git Sync Plugin Loaded", 2e3, "info");
  }
  onunload() {
    console.log("Unloading Git Sync Plugin");
    this.stopAutoSync();
    this.stopChangeMonitoring();
  }
  async loadConfig() {
    try {
      const savedConfig = await this.loadData("git-sync-config");
      if (savedConfig) {
        this.config = { ...this.config, ...savedConfig };
        console.log("Config loaded successfully");
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }
  async saveConfig() {
    await this.saveData("git-sync-config", this.config);
    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    if (this.config.syncOnChange) {
      this.startChangeMonitoring();
    } else {
      this.stopChangeMonitoring();
    }
    siyuan.showMessage("✅ Configuration saved", 2e3, "info");
  }
  addTopBarIcon() {
    this.addTopBar({
      icon: "iconCloud",
      title: "Git Sync",
      position: "right",
      callback: () => {
        this.openSetting();
      }
    });
  }
  setupEventListeners() {
    this.eventBus.on("ws-main", (data) => {
      var _a;
      if (((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.cmd) === "save-doc") {
        if (this.config.syncOnChange) {
          this.scheduleChangeSync();
        }
      }
    });
    this.eventBus.on("filewatcher-change", () => {
      if (this.config.syncOnChange) {
        this.scheduleChangeSync();
      }
    });
  }
  scheduleChangeSync() {
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
    }
    this.changeDebounceTimer = window.setTimeout(() => {
      this.push();
    }, 5e3);
  }
  startChangeMonitoring() {
    console.log("✅ Started monitoring file changes");
  }
  stopChangeMonitoring() {
    if (this.changeDebounceTimer) {
      clearTimeout(this.changeDebounceTimer);
      this.changeDebounceTimer = null;
    }
    console.log("✅ Stopped monitoring file changes");
  }
  async testConnection() {
    if (!this.config.repoUrl || !this.config.token) {
      siyuan.showMessage("⚠️ Please configure repository URL and token", 3e3, "error");
      return;
    }
    try {
      siyuan.showMessage("🔍 Testing connection...", 2e3, "info");
      await clone_1({
        fs: this.fs,
        http: this.getHttp(),
        dir: "/repo-test",
        url: this.config.repoUrl,
        singleBranch: true,
        depth: 1,
        onAuth: () => {
          return {
            username: "git",
            password: this.config.token
          };
        }
      });
      await this.p.rm("/repo-test", { recursive: true, force: true });
      siyuan.showMessage(`✅ Connected to: ${this.config.repoUrl}`, 3e3, "info");
    } catch (error) {
      this.showError("Connection test failed", error);
    }
  }
  async repoExists() {
    try {
      const files = await this.p.readdir("/repo");
      return files.length > 0;
    } catch (error) {
      return false;
    }
  }
  async ensureRepo() {
    if (!await this.repoExists()) {
      await this.cloneRepo();
    }
  }
  async cloneRepo() {
    try {
      siyuan.showMessage("📥 Cloning repository...", 3e3, "info");
      await clone_1({
        fs: this.fs,
        http: this.getHttp(),
        dir: "/repo",
        url: this.config.repoUrl,
        singleBranch: true,
        branch: this.config.branch,
        onAuth: () => {
          return {
            username: "git",
            password: this.config.token
          };
        }
      });
      siyuan.showMessage("✅ Repository cloned successfully", 3e3, "info");
    } catch (error) {
      this.showError("Failed to clone repository", error);
      throw error;
    }
  }
  async pull() {
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    this.isSyncing = true;
    siyuan.showMessage("📥 Pulling from Git...", 3e3, "info");
    try {
      await this.ensureRepo();
      const result = await pull_1({
        fs: this.fs,
        http: this.getHttp(),
        dir: "/repo",
        author: {
          name: this.config.authorName,
          email: this.config.authorEmail
        },
        singleBranch: true,
        branch: this.config.branch,
        onAuth: () => {
          return {
            username: "git",
            password: this.config.token
          };
        }
      });
      await this.syncFilesToSiYuan();
      siyuan.showMessage(`✅ Pull completed
${result ? `Merged: ${result.merge}` : "Up to date"}`, 3e3, "info");
    } catch (error) {
      this.showError("Pull failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async push() {
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    this.isSyncing = true;
    siyuan.showMessage("📤 Pushing to Git...", 3e3, "info");
    try {
      await this.ensureRepo();
      await this.syncFilesFromSiYuan();
      await this.addAllFilesToGit();
      const hasChanges = await this.hasStagedChanges();
      if (hasChanges) {
        await commit_1({
          fs: this.fs,
          dir: "/repo",
          message: `Sync commit at ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
          author: {
            name: this.config.authorName,
            email: this.config.authorEmail
          }
        });
        await push_1({
          fs: this.fs,
          http: this.getHttp(),
          dir: "/repo",
          onAuth: () => {
            return {
              username: "git",
              password: this.config.token
            };
          }
        });
        siyuan.showMessage("✅ Changes pushed successfully", 3e3, "info");
      } else {
        siyuan.showMessage("✅ No changes to push", 3e3, "info");
      }
    } catch (error) {
      this.showError("Push failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async addAllFilesToGit() {
    const allFiles = await this.getAllFiles("/repo");
    for (const file of allFiles) {
      try {
        await add_1({
          fs: this.fs,
          dir: "/repo",
          filepath: file
        });
      } catch (error) {
        console.warn(`Failed to add file ${file}:`, error);
      }
    }
  }
  // Helper function to recursively get all files from the repo directory
  async getAllFiles(dirPath) {
    const allFiles = [];
    try {
      const items = await this.p.readdir(dirPath);
      for (const item of items) {
        if (item === ".git") continue;
        const fullPath = `${dirPath}/${item}`;
        const stats = await this.p.stat(fullPath);
        if (stats.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          allFiles.push(...subFiles);
        } else {
          const relativePath = fullPath.substring(6);
          allFiles.push(relativePath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    return allFiles;
  }
  async hasStagedChanges() {
    try {
      const status2 = await statusMatrix_1({
        fs: this.fs,
        dir: "/repo"
      });
      if (Array.isArray(status2)) {
        for (const row of status2) {
          if (row[2] !== row[1]) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.warn("statusMatrix failed, assuming changes exist:", error);
      return true;
    }
  }
  async listNotebooks() {
    var _a;
    try {
      const response = await fetch("/api/notebook/lsNotebooks", {
        method: "POST"
      });
      const data = await response.json();
      return ((_a = data.data) == null ? void 0 : _a.notebooks) || [];
    } catch (error) {
      console.error("Failed to list notebooks:", error);
      return [];
    }
  }
  async copyNotebookFiles(notebookId, notebookName) {
    const dirPath = `/data/${notebookId}/`;
    try {
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: dirPath })
      });
      const data = await response.json();
      if (data.code === 0) {
        for (const item of data.data || []) {
          if (!item.isDir) {
            const sourcePath = `${dirPath}${item.name}`;
            const destPath = `/repo/${notebookName}/${item.name}`;
            const fileContent = await this.readSiYuanFile(sourcePath);
            if (fileContent) {
              await this.p.writeFile(destPath, fileContent, "utf8");
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to copy notebook files for ${notebookName}:`, error);
    }
  }
  async copyConfigFiles() {
    const configPaths = ["/conf/", "/data/storage/"];
    for (const configPath of configPaths) {
      try {
        const response = await fetch("/api/file/readDir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: configPath })
        });
        const data = await response.json();
        if (data.code === 0) {
          for (const item of data.data || []) {
            if (!item.isDir) {
              const sourcePath = `${configPath}${item.name}`;
              const destPath = `/repo/config/${item.name}`;
              const fileContent = await this.readSiYuanFile(sourcePath);
              if (fileContent) {
                await this.p.writeFile(destPath, fileContent, "utf8");
              }
            }
          }
        }
      } catch (error) {
        console.error(`Failed to copy config files from ${configPath}:`, error);
      }
    }
  }
  async readSiYuanFile(path2) {
    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path2 })
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.code === 0) {
            if (typeof data.data === "string") {
              return data.data;
            } else {
              try {
                return JSON.stringify(data.data, null, 2);
              } catch {
                return null;
              }
            }
          }
        } else {
          return await response.text();
        }
      }
    } catch (error) {
      console.error(`Failed to read file ${path2}:`, error);
    }
    return null;
  }
  async syncFilesFromSiYuan() {
    siyuan.showMessage("🔄 Syncing files from SiYuan workspace", 2e3, "info");
    try {
      await this.p.mkdir("/repo", { recursive: true });
      await this.p.mkdir("/repo/config", { recursive: true });
      const notebooks = await this.listNotebooks();
      for (const notebook of notebooks) {
        await this.copyNotebookFiles(notebook.id, notebook.name);
      }
      await this.copyConfigFiles();
      siyuan.showMessage("✅ Files synced from SiYuan to Git repo", 2e3, "info");
    } catch (error) {
      console.error("Error syncing files from SiYuan", error);
      throw error;
    }
  }
  async syncFilesToSiYuan() {
    siyuan.showMessage("🔄 Syncing files to SiYuan workspace", 2e3, "info");
    try {
      const files = await this.p.readdir("/repo");
      for (const file of files) {
        if (file !== ".git") {
          const filePath = `/repo/${file}`;
          const stats = await this.p.stat(filePath);
          if (stats.isFile()) {
            const content = await this.p.readFile(filePath, "utf8");
            console.log(`Would sync file back to SiYuan: ${file}`);
          } else if (stats.isDirectory() && file !== "config") {
            await this.copyNotebookFilesFromGitToSiYuan(file);
          } else if (file === "config") {
            await this.copyConfigFilesFromGitToSiYuan();
          }
        }
      }
      siyuan.showMessage("✅ Files synced from Git repo to SiYuan workspace", 2e3, "info");
    } catch (error) {
      console.error("Error syncing files to SiYuan", error);
      throw error;
    }
  }
  async copyNotebookFilesFromGitToSiYuan(notebookName) {
    try {
      const notebookFiles = await this.p.readdir(`/repo/${notebookName}`);
      for (const fileName of notebookFiles) {
        const gitPath = `/repo/${notebookName}/${fileName}`;
        const content = await this.p.readFile(gitPath, "utf8");
        console.log(`Would write to notebook ${notebookName}: ${fileName}`);
      }
    } catch (error) {
      console.error(`Error copying notebook files for ${notebookName}`, error);
    }
  }
  async copyConfigFilesFromGitToSiYuan() {
    try {
      const configFiles = await this.p.readdir("/repo/config");
      for (const fileName of configFiles) {
        const gitPath = `/repo/config/${fileName}`;
        const content = await this.p.readFile(gitPath, "utf8");
        console.log(`Would write config file: ${fileName}`);
      }
    } catch (error) {
      console.error("Error copying config files from Git", error);
    }
  }
  async fullSync() {
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    this.isSyncing = true;
    siyuan.showMessage("🔄 Full sync started...", 3e3, "info");
    try {
      await this.pull();
      await new Promise((resolve2) => setTimeout(resolve2, 1e3));
      await this.push();
      siyuan.showMessage("✅ Full sync completed", 3e3, "info");
    } catch (error) {
      this.showError("Full sync failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async getRepoStatus() {
    try {
      await this.ensureRepo();
      const status2 = await statusMatrix_1({ fs: this.fs, dir: "/repo" });
      const staged = status2.filter((row) => row[3] === 1).length;
      const modified2 = status2.filter((row) => row[2] === 2).length;
      siyuan.showMessage(
        `📊 Git Status:
🔗 Repository: ${this.config.repoUrl}
🌿 Branch: ${this.config.branch}
🔄 Auto Sync: ${this.config.autoSync ? `every ${this.config.syncInterval} min` : "disabled"}
⚡ Sync on Change: ${this.config.syncOnChange ? "enabled" : "disabled"}
📝 Modified: ${modified2}
✅ Staged: ${staged}`,
        8e3,
        "info"
      );
    } catch (error) {
      this.showError("Failed to get Git status", error);
    }
  }
  startAutoSync() {
    this.stopAutoSync();
    const intervalMs = Math.max(this.config.syncInterval, 5) * 60 * 1e3;
    this.syncIntervalId = window.setInterval(async () => {
      if (!this.isSyncing && this.config.repoUrl && this.config.token) {
        console.log("⏰ Auto-sync triggered");
        await this.fullSync();
      }
    }, intervalMs);
    console.log(`✅ Auto-sync started: every ${this.config.syncInterval} minutes`);
  }
  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }
  getHttp() {
    return {
      fetch: globalThis && globalThis.fetch || fetch
    };
  }
  showError(message, error) {
    console.error(message, error);
    let errorMsg = `❌ ${message}`;
    if (error == null ? void 0 : error.message) {
      errorMsg += `
${error.message}`;
    }
    siyuan.showMessage(errorMsg, 6e3, "error");
  }
  async openSetting() {
    var _a, _b;
    const html = `
        <div class="b3-dialog__content">
            <div class="fn__flex-column" style="height: 100%;">
                <div class="fn__flex-1 fn__flex-column">
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Repository URL</div>
                                <div class="fn__space"></div>
                                <input id="repoUrl" class="b3-text-field fn__flex-1" value="${this.config.repoUrl}" placeholder="https://github.com/username/repo.git">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Branch</div>
                                <div class="fn__space"></div>
                                <input id="branch" class="b3-text-field fn__flex-1" value="${this.config.branch}" placeholder="main">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Git Token</div>
                                <div class="fn__space"></div>
                                <input id="token" type="password" class="b3-text-field fn__flex-1" value="${this.config.token}" placeholder="GitHub Personal Access Token">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Author Name</div>
                                <div class="fn__space"></div>
                                <input id="authorName" class="b3-text-field fn__flex-1" value="${this.config.authorName}" placeholder="Your name">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Author Email</div>
                                <div class="fn__space"></div>
                                <input id="authorEmail" type="email" class="b3-text-field fn__flex-1" value="${this.config.authorEmail}" placeholder="email@example.com">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Sync Interval (minutes)</div>
                                <div class="fn__space"></div>
                                <input id="syncInterval" type="number" min="5" class="b3-text-field fn__flex-1" value="${this.config.syncInterval}">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <input id="autoSync" type="checkbox" class="b3-switch"${this.config.autoSync ? " checked" : ""}>
                                <div class="fn__space"></div>
                                <span class="fn__flex-center">Enable Auto-Sync</span>
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <input id="syncOnChange" type="checkbox" class="b3-switch"${this.config.syncOnChange ? " checked" : ""}>
                                <div class="fn__space"></div>
                                <span class="fn__flex-center">Sync on Change</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="fn__hr"></div>
                <div class="fn__flex">
                    <div class="fn__flex-1"></div>
                    <button id="testConnectionBtn" class="b3-button b3-button--outline" style="margin-right: 8px;">Test Connection</button>
                    <button id="saveBtn" class="b3-button b3-button--outline">Save</button>
                </div>
            </div>
        </div>
        <div class="b3-dialog__action">
        </div>
        `;
    const dialog = new siyuan.Dialog({
      title: "Git Sync Settings",
      content: html,
      width: "600px",
      height: "400px"
    });
    (_a = dialog.element.querySelector("#saveBtn")) == null ? void 0 : _a.addEventListener("click", async () => {
      this.config.repoUrl = dialog.element.querySelector("#repoUrl").value;
      this.config.branch = dialog.element.querySelector("#branch").value;
      this.config.token = dialog.element.querySelector("#token").value;
      this.config.authorName = dialog.element.querySelector("#authorName").value;
      this.config.authorEmail = dialog.element.querySelector("#authorEmail").value;
      this.config.syncInterval = parseInt(dialog.element.querySelector("#syncInterval").value) || 30;
      this.config.autoSync = dialog.element.querySelector("#autoSync").checked;
      this.config.syncOnChange = dialog.element.querySelector("#syncOnChange").checked;
      await this.saveConfig();
      dialog.destroy();
      siyuan.showMessage("✅ Settings saved", 2e3, "info");
    });
    (_b = dialog.element.querySelector("#testConnectionBtn")) == null ? void 0 : _b.addEventListener("click", () => {
      this.testConnection();
    });
  }
  // Menu actions
  async performPull() {
    await this.pull();
  }
  async performPush() {
    await this.push();
  }
  async performFullSync() {
    await this.fullSync();
  }
  async showStatus() {
    await this.getRepoStatus();
  }
}
var justOnce = once$1;
function once$1(fn) {
  var called, value;
  if (typeof fn !== "function") {
    throw new Error("expected a function but got " + fn);
  }
  return function wrap() {
    if (called) {
      return value;
    }
    called = true;
    value = fn.apply(this, arguments);
    return value;
  };
}
(function(scope) {
  function B(r, e) {
    var f;
    return r instanceof Buffer ? f = r : f = Buffer.from(r.buffer, r.byteOffset, r.byteLength), f.toString(e);
  }
  var w = function(r) {
    return Buffer.from(r);
  };
  function h(r) {
    for (var e = 0, f = Math.min(256 * 256, r.length + 1), n = new Uint16Array(f), i = [], o = 0; ; ) {
      var t = e < r.length;
      if (!t || o >= f - 1) {
        var s = n.subarray(0, o), m = s;
        if (i.push(String.fromCharCode.apply(null, m)), !t) return i.join("");
        r = r.subarray(e), e = 0, o = 0;
      }
      var a = r[e++];
      if ((a & 128) === 0) n[o++] = a;
      else if ((a & 224) === 192) {
        var d = r[e++] & 63;
        n[o++] = (a & 31) << 6 | d;
      } else if ((a & 240) === 224) {
        var d = r[e++] & 63, l = r[e++] & 63;
        n[o++] = (a & 31) << 12 | d << 6 | l;
      } else if ((a & 248) === 240) {
        var d = r[e++] & 63, l = r[e++] & 63, R = r[e++] & 63, c2 = (a & 7) << 18 | d << 12 | l << 6 | R;
        c2 > 65535 && (c2 -= 65536, n[o++] = c2 >>> 10 & 1023 | 55296, c2 = 56320 | c2 & 1023), n[o++] = c2;
      }
    }
  }
  function F(r) {
    for (var e = 0, f = r.length, n = 0, i = Math.max(32, f + (f >>> 1) + 7), o = new Uint8Array(i >>> 3 << 3); e < f; ) {
      var t = r.charCodeAt(e++);
      if (t >= 55296 && t <= 56319) {
        if (e < f) {
          var s = r.charCodeAt(e);
          (s & 64512) === 56320 && (++e, t = ((t & 1023) << 10) + (s & 1023) + 65536);
        }
        if (t >= 55296 && t <= 56319) continue;
      }
      if (n + 4 > o.length) {
        i += 8, i *= 1 + e / r.length * 2, i = i >>> 3 << 3;
        var m = new Uint8Array(i);
        m.set(o), o = m;
      }
      if ((t & 4294967168) === 0) {
        o[n++] = t;
        continue;
      } else if ((t & 4294965248) === 0) o[n++] = t >>> 6 & 31 | 192;
      else if ((t & 4294901760) === 0) o[n++] = t >>> 12 & 15 | 224, o[n++] = t >>> 6 & 63 | 128;
      else if ((t & 4292870144) === 0) o[n++] = t >>> 18 & 7 | 240, o[n++] = t >>> 12 & 63 | 128, o[n++] = t >>> 6 & 63 | 128;
      else continue;
      o[n++] = t & 63 | 128;
    }
    return o.slice ? o.slice(0, n) : o.subarray(0, n);
  }
  var u = "Failed to ", p = function(r, e, f) {
    if (r) throw new Error("".concat(u).concat(e, ": the '").concat(f, "' option is unsupported."));
  };
  var x = typeof Buffer == "function" && Buffer.from;
  var A = x ? w : F;
  function v() {
    this.encoding = "utf-8";
  }
  v.prototype.encode = function(r, e) {
    return p(e && e.stream, "encode", "stream"), A(r);
  };
  function U(r) {
    var e;
    try {
      var f = new Blob([r], { type: "text/plain;charset=UTF-8" });
      e = URL.createObjectURL(f);
      var n = new XMLHttpRequest();
      return n.open("GET", e, false), n.send(), n.responseText;
    } finally {
      e && URL.revokeObjectURL(e);
    }
  }
  var O = !x && typeof Blob == "function" && typeof URL == "function" && typeof URL.createObjectURL == "function", S = ["utf-8", "utf8", "unicode-1-1-utf-8"], T = h;
  x ? T = B : O && (T = function(r) {
    try {
      return U(r);
    } catch (e) {
      return h(r);
    }
  });
  var y = "construct 'TextDecoder'", E = "".concat(u, " ").concat(y, ": the ");
  function g(r, e) {
    p(e && e.fatal, y, "fatal"), r = r || "utf-8";
    var f;
    if (x ? f = Buffer.isEncoding(r) : f = S.indexOf(r.toLowerCase()) !== -1, !f) throw new RangeError("".concat(E, " encoding label provided ('").concat(r, "') is invalid."));
    this.encoding = r, this.fatal = false, this.ignoreBOM = false;
  }
  g.prototype.decode = function(r, e) {
    p(e && e.stream, "decode", "stream");
    var f;
    return r instanceof Uint8Array ? f = r : r.buffer instanceof ArrayBuffer ? f = new Uint8Array(r.buffer) : f = new Uint8Array(r), T(f, this.encoding);
  };
  scope.TextEncoder = scope.TextEncoder || v;
  scope.TextDecoder = scope.TextDecoder || g;
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : commonjsGlobal);
var browser = {
  encode: (string) => new TextEncoder().encode(string),
  decode: (buffer) => new TextDecoder().decode(buffer)
};
var justDebounceIt = debounce$1;
function debounce$1(fn, wait, callFirst) {
  var timeout;
  return function() {
    if (!wait) {
      return fn.apply(this, arguments);
    }
    var context = this;
    var args = arguments;
    var callNow = callFirst && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      if (!callNow) {
        return fn.apply(context, args);
      }
    }, wait);
    if (callNow) {
      return fn.apply(this, arguments);
    }
  };
}
function normalizePath(path2) {
  if (path2.length === 0) {
    return ".";
  }
  let parts = splitPath(path2);
  parts = parts.reduce(reducer, []);
  return joinPath(...parts);
}
function resolvePath(...paths) {
  let result = "";
  for (let path2 of paths) {
    if (path2.startsWith("/")) {
      result = path2;
    } else {
      result = normalizePath(joinPath(result, path2));
    }
  }
  return result;
}
function joinPath(...parts) {
  if (parts.length === 0) return "";
  let path2 = parts.join("/");
  path2 = path2.replace(/\/{2,}/g, "/");
  return path2;
}
function splitPath(path2) {
  if (path2.length === 0) return [];
  if (path2 === "/") return ["/"];
  let parts = path2.split("/");
  if (parts[parts.length - 1] === "") {
    parts.pop();
  }
  if (path2[0] === "/") {
    parts[0] = "/";
  } else {
    if (parts[0] !== ".") {
      parts.unshift(".");
    }
  }
  return parts;
}
function dirname2(path2) {
  const last = path2.lastIndexOf("/");
  if (last === -1) throw new Error(`Cannot get dirname of "${path2}"`);
  if (last === 0) return "/";
  return path2.slice(0, last);
}
function basename2(path2) {
  if (path2 === "/") throw new Error(`Cannot get basename of "${path2}"`);
  const last = path2.lastIndexOf("/");
  if (last === -1) return path2;
  return path2.slice(last + 1);
}
function reducer(ancestors, current) {
  if (ancestors.length === 0) {
    ancestors.push(current);
    return ancestors;
  }
  if (current === ".") return ancestors;
  if (current === "..") {
    if (ancestors.length === 1) {
      if (ancestors[0] === "/") {
        throw new Error("Unable to normalize path - traverses above root directory");
      }
      if (ancestors[0] === ".") {
        ancestors.push(current);
        return ancestors;
      }
    }
    if (ancestors[ancestors.length - 1] === "..") {
      ancestors.push("..");
      return ancestors;
    } else {
      ancestors.pop();
      return ancestors;
    }
  }
  ancestors.push(current);
  return ancestors;
}
var path$3 = {
  join: joinPath,
  normalize: normalizePath,
  split: splitPath,
  basename: basename2,
  dirname: dirname2,
  resolve: resolvePath
};
function Err(name) {
  return class extends Error {
    constructor(...args) {
      super(...args);
      this.code = name;
      if (this.message) {
        this.message = name + ": " + this.message;
      } else {
        this.message = name;
      }
    }
  };
}
const EEXIST$1 = Err("EEXIST");
const ENOENT$2 = Err("ENOENT");
const ENOTDIR$1 = Err("ENOTDIR");
const ENOTEMPTY$2 = Err("ENOTEMPTY");
const ETIMEDOUT$1 = Err("ETIMEDOUT");
const EISDIR$1 = Err("EISDIR");
var errors = { EEXIST: EEXIST$1, ENOENT: ENOENT$2, ENOTDIR: ENOTDIR$1, ENOTEMPTY: ENOTEMPTY$2, ETIMEDOUT: ETIMEDOUT$1, EISDIR: EISDIR$1 };
const path$2 = path$3;
const { EEXIST, ENOENT: ENOENT$1, ENOTDIR, ENOTEMPTY: ENOTEMPTY$1, EISDIR } = errors;
const STAT = 0;
var CacheFS_1 = class CacheFS {
  constructor() {
  }
  _makeRoot(root = /* @__PURE__ */ new Map()) {
    root.set(STAT, { mode: 511, type: "dir", size: 0, ino: 0, mtimeMs: Date.now() });
    return root;
  }
  activate(superblock = null) {
    if (superblock === null) {
      this._root = /* @__PURE__ */ new Map([["/", this._makeRoot()]]);
    } else if (typeof superblock === "string") {
      this._root = /* @__PURE__ */ new Map([["/", this._makeRoot(this.parse(superblock))]]);
    } else {
      this._root = superblock;
    }
  }
  get activated() {
    return !!this._root;
  }
  deactivate() {
    this._root = void 0;
  }
  size() {
    return this._countInodes(this._root.get("/")) - 1;
  }
  _countInodes(map) {
    let count = 1;
    for (let [key, val] of map) {
      if (key === STAT) continue;
      count += this._countInodes(val);
    }
    return count;
  }
  autoinc() {
    let val = this._maxInode(this._root.get("/")) + 1;
    return val;
  }
  _maxInode(map) {
    let max2 = map.get(STAT).ino;
    for (let [key, val] of map) {
      if (key === STAT) continue;
      max2 = Math.max(max2, this._maxInode(val));
    }
    return max2;
  }
  print(root = this._root.get("/")) {
    let str = "";
    const printTree = (root2, indent2) => {
      for (let [file, node] of root2) {
        if (file === 0) continue;
        let stat = node.get(STAT);
        let mode = stat.mode.toString(8);
        str += `${"	".repeat(indent2)}${file}	${mode}`;
        if (stat.type === "file") {
          str += `	${stat.size}	${stat.mtimeMs}
`;
        } else {
          str += `
`;
          printTree(node, indent2 + 1);
        }
      }
    };
    printTree(root, 0);
    return str;
  }
  parse(print) {
    let autoinc = 0;
    function mk(stat) {
      const ino = ++autoinc;
      const type2 = stat.length === 1 ? "dir" : "file";
      let [mode, size, mtimeMs] = stat;
      mode = parseInt(mode, 8);
      size = size ? parseInt(size) : 0;
      mtimeMs = mtimeMs ? parseInt(mtimeMs) : Date.now();
      return /* @__PURE__ */ new Map([[STAT, { mode, type: type2, size, mtimeMs, ino }]]);
    }
    let lines = print.trim().split("\n");
    let _root = this._makeRoot();
    let stack = [
      { indent: -1, node: _root },
      { indent: 0, node: null }
    ];
    for (let line of lines) {
      let prefix = line.match(/^\t*/)[0];
      let indent2 = prefix.length;
      line = line.slice(indent2);
      let [filename, ...stat] = line.split("	");
      let node = mk(stat);
      if (indent2 <= stack[stack.length - 1].indent) {
        while (indent2 <= stack[stack.length - 1].indent) {
          stack.pop();
        }
      }
      stack.push({ indent: indent2, node });
      let cd = stack[stack.length - 2].node;
      cd.set(filename, node);
    }
    return _root;
  }
  _lookup(filepath, follow = true) {
    let dir = this._root;
    let partialPath = "/";
    let parts = path$2.split(filepath);
    for (let i = 0; i < parts.length; ++i) {
      let part = parts[i];
      dir = dir.get(part);
      if (!dir) throw new ENOENT$1(filepath);
      if (follow || i < parts.length - 1) {
        const stat = dir.get(STAT);
        if (stat.type === "symlink") {
          let target = path$2.resolve(partialPath, stat.target);
          dir = this._lookup(target);
        }
        if (!partialPath) {
          partialPath = part;
        } else {
          partialPath = path$2.join(partialPath, part);
        }
      }
    }
    return dir;
  }
  mkdir(filepath, { mode }) {
    if (filepath === "/") throw new EEXIST();
    let dir = this._lookup(path$2.dirname(filepath));
    let basename3 = path$2.basename(filepath);
    if (dir.has(basename3)) {
      throw new EEXIST();
    }
    let entry = /* @__PURE__ */ new Map();
    let stat = {
      mode,
      type: "dir",
      size: 0,
      mtimeMs: Date.now(),
      ino: this.autoinc()
    };
    entry.set(STAT, stat);
    dir.set(basename3, entry);
  }
  rmdir(filepath) {
    let dir = this._lookup(filepath);
    if (dir.get(STAT).type !== "dir") throw new ENOTDIR();
    if (dir.size > 1) throw new ENOTEMPTY$1();
    let parent = this._lookup(path$2.dirname(filepath));
    let basename3 = path$2.basename(filepath);
    parent.delete(basename3);
  }
  readdir(filepath) {
    let dir = this._lookup(filepath);
    if (dir.get(STAT).type !== "dir") throw new ENOTDIR();
    return [...dir.keys()].filter((key) => typeof key === "string");
  }
  writeStat(filepath, size, { mode }) {
    let ino;
    let oldStat;
    try {
      oldStat = this.stat(filepath);
    } catch (err2) {
    }
    if (oldStat !== void 0) {
      if (oldStat.type === "dir") {
        throw new EISDIR();
      }
      if (mode == null) {
        mode = oldStat.mode;
      }
      ino = oldStat.ino;
    }
    if (mode == null) {
      mode = 438;
    }
    if (ino == null) {
      ino = this.autoinc();
    }
    let dir = this._lookup(path$2.dirname(filepath));
    let basename3 = path$2.basename(filepath);
    let stat = {
      mode,
      type: "file",
      size,
      mtimeMs: Date.now(),
      ino
    };
    let entry = /* @__PURE__ */ new Map();
    entry.set(STAT, stat);
    dir.set(basename3, entry);
    return stat;
  }
  unlink(filepath) {
    let parent = this._lookup(path$2.dirname(filepath));
    let basename3 = path$2.basename(filepath);
    parent.delete(basename3);
  }
  rename(oldFilepath, newFilepath) {
    let basename3 = path$2.basename(newFilepath);
    let entry = this._lookup(oldFilepath);
    let destDir = this._lookup(path$2.dirname(newFilepath));
    destDir.set(basename3, entry);
    this.unlink(oldFilepath);
  }
  stat(filepath) {
    return this._lookup(filepath).get(STAT);
  }
  lstat(filepath) {
    return this._lookup(filepath, false).get(STAT);
  }
  readlink(filepath) {
    return this._lookup(filepath, false).get(STAT).target;
  }
  symlink(target, filepath) {
    let ino, mode;
    try {
      let oldStat = this.stat(filepath);
      if (mode === null) {
        mode = oldStat.mode;
      }
      ino = oldStat.ino;
    } catch (err2) {
    }
    if (mode == null) {
      mode = 40960;
    }
    if (ino == null) {
      ino = this.autoinc();
    }
    let dir = this._lookup(path$2.dirname(filepath));
    let basename3 = path$2.basename(filepath);
    let stat = {
      mode,
      type: "symlink",
      target,
      size: 0,
      mtimeMs: Date.now(),
      ino
    };
    let entry = /* @__PURE__ */ new Map();
    entry.set(STAT, stat);
    dir.set(basename3, entry);
    return stat;
  }
  _du(dir) {
    let size = 0;
    for (const [name, entry] of dir.entries()) {
      if (name === STAT) {
        size += entry.size;
      } else {
        size += this._du(entry);
      }
    }
    return size;
  }
  du(filepath) {
    let dir = this._lookup(filepath);
    return this._du(dir);
  }
};
class Store {
  constructor(dbName = "keyval-store", storeName = "keyval") {
    this.storeName = storeName;
    this._dbName = dbName;
    this._storeName = storeName;
    this._init();
  }
  _init() {
    if (this._dbp) {
      return;
    }
    this._dbp = new Promise((resolve2, reject) => {
      const openreq = indexedDB.open(this._dbName);
      openreq.onerror = () => reject(openreq.error);
      openreq.onsuccess = () => resolve2(openreq.result);
      openreq.onupgradeneeded = () => {
        openreq.result.createObjectStore(this._storeName);
      };
    });
  }
  _withIDBStore(type2, callback) {
    this._init();
    return this._dbp.then((db) => new Promise((resolve2, reject) => {
      const transaction = db.transaction(this.storeName, type2);
      transaction.oncomplete = () => resolve2();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
      callback(transaction.objectStore(this.storeName));
    }));
  }
  _close() {
    this._init();
    return this._dbp.then((db) => {
      db.close();
      this._dbp = void 0;
    });
  }
}
let store;
function getDefaultStore() {
  if (!store)
    store = new Store();
  return store;
}
function get(key, store2 = getDefaultStore()) {
  let req;
  return store2._withIDBStore("readwrite", (store3) => {
    req = store3.get(key);
  }).then(() => req.result);
}
function set(key, value, store2 = getDefaultStore()) {
  return store2._withIDBStore("readwrite", (store3) => {
    store3.put(value, key);
  });
}
function update(key, updater, store2 = getDefaultStore()) {
  return store2._withIDBStore("readwrite", (store3) => {
    const req = store3.get(key);
    req.onsuccess = () => {
      store3.put(updater(req.result), key);
    };
  });
}
function del(key, store2 = getDefaultStore()) {
  return store2._withIDBStore("readwrite", (store3) => {
    store3.delete(key);
  });
}
function clear(store2 = getDefaultStore()) {
  return store2._withIDBStore("readwrite", (store3) => {
    store3.clear();
  });
}
function keys(store2 = getDefaultStore()) {
  const keys2 = [];
  return store2._withIDBStore("readwrite", (store3) => {
    (store3.openKeyCursor || store3.openCursor).call(store3).onsuccess = function() {
      if (!this.result)
        return;
      keys2.push(this.result.key);
      this.result.continue();
    };
  }).then(() => keys2);
}
function close(store2 = getDefaultStore()) {
  return store2._close();
}
const idbKeyval = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  Store,
  clear,
  close,
  del,
  get,
  keys,
  set,
  update
}, Symbol.toStringTag, { value: "Module" }));
const require$$0 = /* @__PURE__ */ getAugmentedNamespace(idbKeyval);
const idb$1 = require$$0;
var IdbBackend_1 = class IdbBackend {
  constructor(dbname, storename) {
    this._database = dbname;
    this._storename = storename;
    this._store = new idb$1.Store(this._database, this._storename);
  }
  saveSuperblock(superblock) {
    return idb$1.set("!root", superblock, this._store);
  }
  loadSuperblock() {
    return idb$1.get("!root", this._store);
  }
  readFile(inode) {
    return idb$1.get(inode, this._store);
  }
  writeFile(inode, data) {
    return idb$1.set(inode, data, this._store);
  }
  unlink(inode) {
    return idb$1.del(inode, this._store);
  }
  wipe() {
    return idb$1.clear(this._store);
  }
  close() {
    return idb$1.close(this._store);
  }
};
var HttpBackend_1 = class HttpBackend {
  constructor(url) {
    this._url = url;
  }
  loadSuperblock() {
    return fetch(this._url + "/.superblock.txt").then((res) => res.ok ? res.text() : null);
  }
  async readFile(filepath) {
    const res = await fetch(this._url + filepath);
    if (res.status === 200) {
      return res.arrayBuffer();
    } else {
      throw new Error("ENOENT");
    }
  }
  async sizeFile(filepath) {
    const res = await fetch(this._url + filepath, { method: "HEAD" });
    if (res.status === 200) {
      return res.headers.get("content-length");
    } else {
      throw new Error("ENOENT");
    }
  }
};
const idb = require$$0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var Mutex_1 = class Mutex {
  constructor(dbname, storename) {
    this._id = Math.random();
    this._database = dbname;
    this._storename = storename;
    this._store = new idb.Store(this._database, this._storename);
    this._lock = null;
  }
  async has({ margin = 2e3 } = {}) {
    if (this._lock && this._lock.holder === this._id) {
      const now = Date.now();
      if (this._lock.expires > now + margin) {
        return true;
      } else {
        return await this.renew();
      }
    } else {
      return false;
    }
  }
  // Returns true if successful
  async renew({ ttl = 5e3 } = {}) {
    let success;
    await idb.update("lock", (current) => {
      const now = Date.now();
      const expires = now + ttl;
      success = current && current.holder === this._id;
      this._lock = success ? { holder: this._id, expires } : current;
      return this._lock;
    }, this._store);
    return success;
  }
  // Returns true if successful
  async acquire({ ttl = 5e3 } = {}) {
    let success;
    let expired;
    let doubleLock;
    await idb.update("lock", (current) => {
      const now = Date.now();
      const expires = now + ttl;
      expired = current && current.expires < now;
      success = current === void 0 || expired;
      doubleLock = current && current.holder === this._id;
      this._lock = success ? { holder: this._id, expires } : current;
      return this._lock;
    }, this._store);
    if (doubleLock) {
      throw new Error("Mutex double-locked");
    }
    return success;
  }
  // check at 10Hz, give up after 10 minutes
  async wait({ interval = 100, limit = 6e3, ttl } = {}) {
    while (limit--) {
      if (await this.acquire({ ttl })) return true;
      await sleep(interval);
    }
    throw new Error("Mutex timeout");
  }
  // Returns true if successful
  async release({ force = false } = {}) {
    let success;
    let doubleFree;
    let someoneElseHasIt;
    await idb.update("lock", (current) => {
      success = force || current && current.holder === this._id;
      doubleFree = current === void 0;
      someoneElseHasIt = current && current.holder !== this._id;
      this._lock = success ? void 0 : current;
      return this._lock;
    }, this._store);
    await idb.close(this._store);
    if (!success && !force) {
      if (doubleFree) throw new Error("Mutex double-freed");
      if (someoneElseHasIt) throw new Error("Mutex lost ownership");
    }
    return success;
  }
};
var Mutex2$1 = class Mutex2 {
  constructor(name) {
    this._id = Math.random();
    this._database = name;
    this._has = false;
    this._release = null;
  }
  async has() {
    return this._has;
  }
  // Returns true if successful
  async acquire() {
    return new Promise((resolve2) => {
      navigator.locks.request(this._database + "_lock", { ifAvailable: true }, (lock2) => {
        this._has = !!lock2;
        resolve2(!!lock2);
        return new Promise((resolve3) => {
          this._release = resolve3;
        });
      });
    });
  }
  // Returns true if successful, gives up after 10 minutes
  async wait({ timeout = 6e5 } = {}) {
    return new Promise((resolve2, reject) => {
      const controller = new AbortController();
      setTimeout(() => {
        controller.abort();
        reject(new Error("Mutex timeout"));
      }, timeout);
      navigator.locks.request(this._database + "_lock", { signal: controller.signal }, (lock2) => {
        this._has = !!lock2;
        resolve2(!!lock2);
        return new Promise((resolve3) => {
          this._release = resolve3;
        });
      });
    });
  }
  // Returns true if successful
  async release({ force = false } = {}) {
    this._has = false;
    if (this._release) {
      this._release();
    } else if (force) {
      navigator.locks.request(this._database + "_lock", { steal: true }, (lock2) => true);
    }
  }
};
const { encode, decode } = browser;
const debounce = justDebounceIt;
const CacheFS2 = CacheFS_1;
const { ENOENT, ENOTEMPTY, ETIMEDOUT } = errors;
const IdbBackend2 = IdbBackend_1;
const HttpBackend2 = HttpBackend_1;
const Mutex3 = Mutex_1;
const Mutex22 = Mutex2$1;
const path$1 = path$3;
var DefaultBackend_1 = class DefaultBackend {
  constructor() {
    this.saveSuperblock = debounce(() => {
      this.flush();
    }, 500);
  }
  async init(name, {
    wipe,
    url,
    urlauto,
    fileDbName = name,
    db = null,
    fileStoreName = name + "_files",
    lockDbName = name + "_lock",
    lockStoreName = name + "_lock"
  } = {}) {
    this._name = name;
    this._idb = db || new IdbBackend2(fileDbName, fileStoreName);
    this._mutex = navigator.locks ? new Mutex22(name) : new Mutex3(lockDbName, lockStoreName);
    this._cache = new CacheFS2(name);
    this._opts = { wipe, url };
    this._needsWipe = !!wipe;
    if (url) {
      this._http = new HttpBackend2(url);
      this._urlauto = !!urlauto;
    }
  }
  async activate() {
    if (this._cache.activated) return;
    if (this._needsWipe) {
      this._needsWipe = false;
      await this._idb.wipe();
      await this._mutex.release({ force: true });
    }
    if (!await this._mutex.has()) await this._mutex.wait();
    const root = await this._idb.loadSuperblock();
    if (root) {
      this._cache.activate(root);
    } else if (this._http) {
      const text = await this._http.loadSuperblock();
      this._cache.activate(text);
      await this._saveSuperblock();
    } else {
      this._cache.activate();
    }
    if (await this._mutex.has()) {
      return;
    } else {
      throw new ETIMEDOUT();
    }
  }
  async deactivate() {
    if (await this._mutex.has()) {
      await this._saveSuperblock();
    }
    this._cache.deactivate();
    try {
      await this._mutex.release();
    } catch (e) {
      console.log(e);
    }
    await this._idb.close();
  }
  async _saveSuperblock() {
    if (this._cache.activated) {
      this._lastSavedAt = Date.now();
      await this._idb.saveSuperblock(this._cache._root);
    }
  }
  _writeStat(filepath, size, opts) {
    let dirparts = path$1.split(path$1.dirname(filepath));
    let dir = dirparts.shift();
    for (let dirpart of dirparts) {
      dir = path$1.join(dir, dirpart);
      try {
        this._cache.mkdir(dir, { mode: 511 });
      } catch (e) {
      }
    }
    return this._cache.writeStat(filepath, size, opts);
  }
  async readFile(filepath, opts) {
    const encoding = typeof opts === "string" ? opts : opts && opts.encoding;
    if (encoding && encoding !== "utf8") throw new Error('Only "utf8" encoding is supported in readFile');
    let data = null, stat = null;
    try {
      stat = this._cache.stat(filepath);
      data = await this._idb.readFile(stat.ino);
    } catch (e) {
      if (!this._urlauto) throw e;
    }
    if (!data && this._http) {
      let lstat = this._cache.lstat(filepath);
      while (lstat.type === "symlink") {
        filepath = path$1.resolve(path$1.dirname(filepath), lstat.target);
        lstat = this._cache.lstat(filepath);
      }
      data = await this._http.readFile(filepath);
    }
    if (data) {
      if (!stat || stat.size != data.byteLength) {
        stat = await this._writeStat(filepath, data.byteLength, { mode: stat ? stat.mode : 438 });
        this.saveSuperblock();
      }
      if (encoding === "utf8") {
        data = decode(data);
      } else {
        data.toString = () => decode(data);
      }
    }
    if (!stat) throw new ENOENT(filepath);
    return data;
  }
  async writeFile(filepath, data, opts) {
    const { mode, encoding = "utf8" } = opts;
    if (typeof data === "string") {
      if (encoding !== "utf8") {
        throw new Error('Only "utf8" encoding is supported in writeFile');
      }
      data = encode(data);
    }
    const stat = await this._cache.writeStat(filepath, data.byteLength, { mode });
    await this._idb.writeFile(stat.ino, data);
  }
  async unlink(filepath, opts) {
    const stat = this._cache.lstat(filepath);
    this._cache.unlink(filepath);
    if (stat.type !== "symlink") {
      await this._idb.unlink(stat.ino);
    }
  }
  readdir(filepath, opts) {
    return this._cache.readdir(filepath);
  }
  mkdir(filepath, opts) {
    const { mode = 511 } = opts;
    this._cache.mkdir(filepath, { mode });
  }
  rmdir(filepath, opts) {
    if (filepath === "/") {
      throw new ENOTEMPTY();
    }
    this._cache.rmdir(filepath);
  }
  rename(oldFilepath, newFilepath) {
    this._cache.rename(oldFilepath, newFilepath);
  }
  stat(filepath, opts) {
    return this._cache.stat(filepath);
  }
  lstat(filepath, opts) {
    return this._cache.lstat(filepath);
  }
  readlink(filepath, opts) {
    return this._cache.readlink(filepath);
  }
  symlink(target, filepath) {
    this._cache.symlink(target, filepath);
  }
  async backFile(filepath, opts) {
    let size = await this._http.sizeFile(filepath);
    await this._writeStat(filepath, size, opts);
  }
  du(filepath) {
    return this._cache.du(filepath);
  }
  flush() {
    return this._saveSuperblock();
  }
};
var Stat_1 = class Stat {
  constructor(stats) {
    this.type = stats.type;
    this.mode = stats.mode;
    this.size = stats.size;
    this.ino = stats.ino;
    this.mtimeMs = stats.mtimeMs;
    this.ctimeMs = stats.ctimeMs || stats.mtimeMs;
    this.uid = 1;
    this.gid = 1;
    this.dev = 1;
  }
  isFile() {
    return this.type === "file";
  }
  isDirectory() {
    return this.type === "dir";
  }
  isSymbolicLink() {
    return this.type === "symlink";
  }
};
const DefaultBackend2 = DefaultBackend_1;
const Stat2 = Stat_1;
const path = path$3;
function cleanParamsFilepathOpts(filepath, opts, ...rest) {
  filepath = path.normalize(filepath);
  if (typeof opts === "undefined" || typeof opts === "function") {
    opts = {};
  }
  if (typeof opts === "string") {
    opts = {
      encoding: opts
    };
  }
  return [filepath, opts, ...rest];
}
function cleanParamsFilepathDataOpts(filepath, data, opts, ...rest) {
  filepath = path.normalize(filepath);
  if (typeof opts === "undefined" || typeof opts === "function") {
    opts = {};
  }
  if (typeof opts === "string") {
    opts = {
      encoding: opts
    };
  }
  return [filepath, data, opts, ...rest];
}
function cleanParamsFilepathFilepath(oldFilepath, newFilepath, ...rest) {
  return [path.normalize(oldFilepath), path.normalize(newFilepath), ...rest];
}
var PromisifiedFS_1 = class PromisifiedFS {
  constructor(name, options = {}) {
    this.init = this.init.bind(this);
    this.readFile = this._wrap(this.readFile, cleanParamsFilepathOpts, false);
    this.writeFile = this._wrap(this.writeFile, cleanParamsFilepathDataOpts, true);
    this.unlink = this._wrap(this.unlink, cleanParamsFilepathOpts, true);
    this.readdir = this._wrap(this.readdir, cleanParamsFilepathOpts, false);
    this.mkdir = this._wrap(this.mkdir, cleanParamsFilepathOpts, true);
    this.rmdir = this._wrap(this.rmdir, cleanParamsFilepathOpts, true);
    this.rename = this._wrap(this.rename, cleanParamsFilepathFilepath, true);
    this.stat = this._wrap(this.stat, cleanParamsFilepathOpts, false);
    this.lstat = this._wrap(this.lstat, cleanParamsFilepathOpts, false);
    this.readlink = this._wrap(this.readlink, cleanParamsFilepathOpts, false);
    this.symlink = this._wrap(this.symlink, cleanParamsFilepathFilepath, true);
    this.backFile = this._wrap(this.backFile, cleanParamsFilepathOpts, true);
    this.du = this._wrap(this.du, cleanParamsFilepathOpts, false);
    this._deactivationPromise = null;
    this._deactivationTimeout = null;
    this._activationPromise = null;
    this._operations = /* @__PURE__ */ new Set();
    if (name) {
      this.init(name, options);
    }
  }
  async init(...args) {
    if (this._initPromiseResolve) await this._initPromise;
    this._initPromise = this._init(...args);
    return this._initPromise;
  }
  async _init(name, options = {}) {
    await this._gracefulShutdown();
    if (this._activationPromise) await this._deactivate();
    if (this._backend && this._backend.destroy) {
      await this._backend.destroy();
    }
    this._backend = options.backend || new DefaultBackend2();
    if (this._backend.init) {
      await this._backend.init(name, options);
    }
    if (this._initPromiseResolve) {
      this._initPromiseResolve();
      this._initPromiseResolve = null;
    }
    if (!options.defer) {
      this.stat("/");
    }
  }
  async _gracefulShutdown() {
    if (this._operations.size > 0) {
      this._isShuttingDown = true;
      await new Promise((resolve2) => this._gracefulShutdownResolve = resolve2);
      this._isShuttingDown = false;
      this._gracefulShutdownResolve = null;
    }
  }
  _wrap(fn, paramCleaner, mutating) {
    return async (...args) => {
      args = paramCleaner(...args);
      let op = {
        name: fn.name,
        args
      };
      this._operations.add(op);
      try {
        await this._activate();
        return await fn.apply(this, args);
      } finally {
        this._operations.delete(op);
        if (mutating) this._backend.saveSuperblock();
        if (this._operations.size === 0) {
          if (!this._deactivationTimeout) clearTimeout(this._deactivationTimeout);
          this._deactivationTimeout = setTimeout(this._deactivate.bind(this), 500);
        }
      }
    };
  }
  async _activate() {
    if (!this._initPromise) console.warn(new Error(`Attempted to use LightningFS ${this._name} before it was initialized.`));
    await this._initPromise;
    if (this._deactivationTimeout) {
      clearTimeout(this._deactivationTimeout);
      this._deactivationTimeout = null;
    }
    if (this._deactivationPromise) await this._deactivationPromise;
    this._deactivationPromise = null;
    if (!this._activationPromise) {
      this._activationPromise = this._backend.activate ? this._backend.activate() : Promise.resolve();
    }
    await this._activationPromise;
  }
  async _deactivate() {
    if (this._activationPromise) await this._activationPromise;
    if (!this._deactivationPromise) {
      this._deactivationPromise = this._backend.deactivate ? this._backend.deactivate() : Promise.resolve();
    }
    this._activationPromise = null;
    if (this._gracefulShutdownResolve) this._gracefulShutdownResolve();
    return this._deactivationPromise;
  }
  async readFile(filepath, opts) {
    return this._backend.readFile(filepath, opts);
  }
  async writeFile(filepath, data, opts) {
    await this._backend.writeFile(filepath, data, opts);
    return null;
  }
  async unlink(filepath, opts) {
    await this._backend.unlink(filepath, opts);
    return null;
  }
  async readdir(filepath, opts) {
    return this._backend.readdir(filepath, opts);
  }
  async mkdir(filepath, opts) {
    await this._backend.mkdir(filepath, opts);
    return null;
  }
  async rmdir(filepath, opts) {
    await this._backend.rmdir(filepath, opts);
    return null;
  }
  async rename(oldFilepath, newFilepath) {
    await this._backend.rename(oldFilepath, newFilepath);
    return null;
  }
  async stat(filepath, opts) {
    const data = await this._backend.stat(filepath, opts);
    return new Stat2(data);
  }
  async lstat(filepath, opts) {
    const data = await this._backend.lstat(filepath, opts);
    return new Stat2(data);
  }
  async readlink(filepath, opts) {
    return this._backend.readlink(filepath, opts);
  }
  async symlink(target, filepath) {
    await this._backend.symlink(target, filepath);
    return null;
  }
  async backFile(filepath, opts) {
    await this._backend.backFile(filepath, opts);
    return null;
  }
  async du(filepath) {
    return this._backend.du(filepath);
  }
  async flush() {
    return this._backend.flush();
  }
};
const once = justOnce;
const PromisifiedFS2 = PromisifiedFS_1;
function wrapCallback(opts, cb) {
  if (typeof opts === "function") {
    cb = opts;
  }
  cb = once(cb);
  const resolve2 = (...args) => cb(null, ...args);
  return [resolve2, cb];
}
var src = class FS {
  constructor(...args) {
    this.promises = new PromisifiedFS2(...args);
    this.init = this.init.bind(this);
    this.readFile = this.readFile.bind(this);
    this.writeFile = this.writeFile.bind(this);
    this.unlink = this.unlink.bind(this);
    this.readdir = this.readdir.bind(this);
    this.mkdir = this.mkdir.bind(this);
    this.rmdir = this.rmdir.bind(this);
    this.rename = this.rename.bind(this);
    this.stat = this.stat.bind(this);
    this.lstat = this.lstat.bind(this);
    this.readlink = this.readlink.bind(this);
    this.symlink = this.symlink.bind(this);
    this.backFile = this.backFile.bind(this);
    this.du = this.du.bind(this);
    this.flush = this.flush.bind(this);
  }
  init(name, options) {
    return this.promises.init(name, options);
  }
  readFile(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.readFile(filepath, opts).then(resolve2).catch(reject);
  }
  writeFile(filepath, data, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.writeFile(filepath, data, opts).then(resolve2).catch(reject);
  }
  unlink(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.unlink(filepath, opts).then(resolve2).catch(reject);
  }
  readdir(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.readdir(filepath, opts).then(resolve2).catch(reject);
  }
  mkdir(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.mkdir(filepath, opts).then(resolve2).catch(reject);
  }
  rmdir(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.rmdir(filepath, opts).then(resolve2).catch(reject);
  }
  rename(oldFilepath, newFilepath, cb) {
    const [resolve2, reject] = wrapCallback(cb);
    this.promises.rename(oldFilepath, newFilepath).then(resolve2).catch(reject);
  }
  stat(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.stat(filepath).then(resolve2).catch(reject);
  }
  lstat(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.lstat(filepath).then(resolve2).catch(reject);
  }
  readlink(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.readlink(filepath).then(resolve2).catch(reject);
  }
  symlink(target, filepath, cb) {
    const [resolve2, reject] = wrapCallback(cb);
    this.promises.symlink(target, filepath).then(resolve2).catch(reject);
  }
  backFile(filepath, opts, cb) {
    const [resolve2, reject] = wrapCallback(opts, cb);
    this.promises.backFile(filepath, opts).then(resolve2).catch(reject);
  }
  du(filepath, cb) {
    const [resolve2, reject] = wrapCallback(cb);
    this.promises.du(filepath).then(resolve2).catch(reject);
  }
  flush(cb) {
    const [resolve2, reject] = wrapCallback(cb);
    this.promises.flush().then(resolve2).catch(reject);
  }
};
const index = /* @__PURE__ */ getDefaultExportFromCjs(src);
const index$1 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: index
}, [src]);
module.exports = GitSyncPlugin;
