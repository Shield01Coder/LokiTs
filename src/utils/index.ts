
  
      // wrapping in object to expose to default export for potential user override.
      // warning: overriding these methods will override behavior for all loki db instances in memory.

import { Utils } from "./objects";

      // warning: if you use binary indices these comparators should be the same for all inserts/updates/removes.
      var Comparators = {
        aeq: aeqHelper,
        lt: ltHelper,
        gt: gtHelper
      };
  
      /** Helper function for determining 'loki' abstract equality which is a little more abstract than ==
       *     aeqHelper(5, '5') === true
       *     aeqHelper(5.0, '5') === true
       *     aeqHelper(new Date("1/1/2011"), new Date("1/1/2011")) === true
       *     aeqHelper({a:1}, {z:4}) === true (all objects sorted equally)
       *     aeqHelper([1, 2, 3], [1, 3]) === false
       *     aeqHelper([1, 2, 3], [1, 2, 3]) === true
       *     aeqHelper(undefined, null) === true
       */
      function aeqHelper(prop1:any, prop2:any): boolean {
        var cv1, cv2, t1, t2;
  
        if (prop1 === prop2) return true;
  
        // 'falsy' and Boolean handling
        if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
          // dates and NaN conditions (typed dates before serialization)
          switch (prop1) {
            case undefined: t1 = 1; break;
            case null: t1 = 1; break;
            case false: t1 = 3; break;
            case true: t1 = 4; break;
            case "": t1 = 5; break;
            default: t1 = (prop1 === prop1) ? 9 : 0; break;
          }
  
          switch (prop2) {
            case undefined: t2 = 1; break;
            case null: t2 = 1; break;
            case false: t2 = 3; break;
            case true: t2 = 4; break;
            case "": t2 = 5; break;
            default: t2 = (prop2 === prop2) ? 9 : 0; break;
          }
  
          // one or both is edge case
          if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2);
          }
        }
  
        // Handle 'Number-like' comparisons
        cv1 = Number(prop1);
        cv2 = Number(prop2);
  
        // if one or both are 'number-like'...
        if (cv1 === cv1 || cv2 === cv2) {
          return (cv1 === cv2);
        }
  
        // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
        cv1 = prop1.toString();
        cv2 = prop2.toString();
  
        return (cv1 == cv2);
      }
  
      /** Helper function for determining 'less-than' conditions for ops, sorting, and binary indices.
       *     In the future we might want $lt and $gt ops to use their own functionality/helper.
       *     Since binary indices on a property might need to index [12, NaN, new Date(), Infinity], we
       *     need this function (as well as gtHelper) to always ensure one value is LT, GT, or EQ to another.
       */
      function ltHelper(prop1:any, prop2:any, equal:any) {
        var cv1, cv2, t1, t2;
  
        // if one of the params is falsy or strictly true or not equal to itself
        // 0, 0.0, "", NaN, null, undefined, not defined, false, true
        if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
          switch (prop1) {
            case undefined: t1 = 1; break;
            case null: t1 = 1; break;
            case false: t1 = 3; break;
            case true: t1 = 4; break;
            case "": t1 = 5; break;
            // if strict equal probably 0 so sort higher, otherwise probably NaN so sort lower than even null
            default: t1 = (prop1 === prop1) ? 9 : 0; break;
          }
  
          switch (prop2) {
            case undefined: t2 = 1; break;
            case null: t2 = 1; break;
            case false: t2 = 3; break;
            case true: t2 = 4; break;
            case "": t2 = 5; break;
            default: t2 = (prop2 === prop2) ? 9 : 0; break;
          }
  
          // one or both is edge case
          if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2) ? equal : (t1 < t2);
          }
        }
  
        // if both are numbers (string encoded or not), compare as numbers
        cv1 = Number(prop1);
        cv2 = Number(prop2);
  
        if (cv1 === cv1 && cv2 === cv2) {
          if (cv1 < cv2) return true;
          if (cv1 > cv2) return false;
          return equal;
        }
  
        if (cv1 === cv1 && cv2 !== cv2) {
          return true;
        }
  
        if (cv2 === cv2 && cv1 !== cv1) {
          return false;
        }
  
        if (prop1 < prop2) return true;
        if (prop1 > prop2) return false;
        if (prop1 == prop2) return equal;
  
        // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
        cv1 = prop1.toString();
        cv2 = prop2.toString();
  
        if (cv1 < cv2) {
          return true;
        }
  
        if (cv1 == cv2) {
          return equal;
        }
  
        return false;
      }
  
      function gtHelper(prop1, prop2, equal) {
        var cv1, cv2, t1, t2;
  
        // 'falsy' and Boolean handling
        if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
          switch (prop1) {
            case undefined: t1 = 1; break;
            case null: t1 = 1; break;
            case false: t1 = 3; break;
            case true: t1 = 4; break;
            case "": t1 = 5; break;
            // NaN 0
            default: t1 = (prop1 === prop1) ? 9 : 0; break;
          }
  
          switch (prop2) {
            case undefined: t2 = 1; break;
            case null: t2 = 1; break;
            case false: t2 = 3; break;
            case true: t2 = 4; break;
            case "": t2 = 5; break;
            default: t2 = (prop2 === prop2) ? 9 : 0; break;
          }
  
          // one or both is edge case
          if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2) ? equal : (t1 > t2);
          }
        }
  
        // if both are numbers (string encoded or not), compare as numbers
        cv1 = Number(prop1);
        cv2 = Number(prop2);
        if (cv1 === cv1 && cv2 === cv2) {
          if (cv1 > cv2) return true;
          if (cv1 < cv2) return false;
          return equal;
        }
  
        if (cv1 === cv1 && cv2 !== cv2) {
          return false;
        }
  
        if (cv2 === cv2 && cv1 !== cv1) {
          return true;
        }
  
        if (prop1 > prop2) return true;
        if (prop1 < prop2) return false;
        if (prop1 == prop2) return equal;
  
        // not strict equal nor less than nor gt so must be dates or mixed types
        // convert to string and use that to compare
        cv1 = prop1.toString();
        cv2 = prop2.toString();
  
        if (cv1 > cv2) {
          return true;
        }
  
        if (cv1 == cv2) {
          return equal;
        }
  
        return false;
      }
  
      function sortHelper(prop1, prop2, desc) {
        if (Comparators.aeq(prop1, prop2)) return 0;
  
        if (Comparators.lt(prop1, prop2, false)) {
          return (desc) ? (1) : (-1);
        }
  
        if (Comparators.gt(prop1, prop2, false)) {
          return (desc) ? (-1) : (1);
        }
  
        // not lt, not gt so implied equality-- date compatible
        return 0;
      }
  
      /**
       * compoundeval() - helper function for compoundsort(), performing individual object comparisons
       *
       * @param {array} properties - array of property names, in order, by which to evaluate sort order
       * @param {object} obj1 - first object to compare
       * @param {object} obj2 - second object to compare
       * @returns {integer} 0, -1, or 1 to designate if identical (sortwise) or which should be first
       */
      function compoundeval(properties, obj1, obj2) {
        var res = 0;
        var prop, field, val1, val2, arr, path;
        for (var i = 0, len = properties.length; i < len; i++) {
          prop = properties[i];
          field = prop[0];
          if (~field.indexOf('.')) {
            arr = field.split('.');
            val1 = Utils.getIn(obj1, arr, true);
            val2 = Utils.getIn(obj2, arr, true);
          } else {
            val1 = obj1[field];
            val2 = obj2[field];
          }
          res = sortHelper(val1, val2, prop[1]);
          if (res !== 0) {
            return res;
          }
        }
        return 0;
      }
  
      /**
       * dotSubScan - helper function used for dot notation queries.
       *
       * @param {object} root - object to traverse
       * @param {array} paths - array of properties to drill into
       * @param {function} fun - evaluation function to test with
       * @param {any} value - comparative value to also pass to (compare) fun
       * @param {any} extra - extra arg to also pass to compare fun
       * @param {number} poffset - index of the item in 'paths' to start the sub-scan from
       */
      function dotSubScan(root, paths, fun, value, extra, poffset) {
        var pathOffset = poffset || 0;
        var path = paths[pathOffset];
  
        var valueFound = false;
        var element;
        if (typeof root === 'object' && path in root) {
          element = root[path];
        }
        if (pathOffset + 1 >= paths.length) {
          // if we have already expanded out the dot notation,
          // then just evaluate the test function and value on the element
          valueFound = fun(element, value, extra);
        } else if (Array.isArray(element)) {
          for (var index = 0, len = element.length; index < len; index += 1) {
            valueFound = dotSubScan(element[index], paths, fun, value, extra, pathOffset + 1);
            if (valueFound === true) {
              break;
            }
          }
        } else {
          valueFound = dotSubScan(element, paths, fun, value, extra, pathOffset + 1);
        }
  
        return valueFound;
      }
  
      function containsCheckFn(a) {
        if (typeof a === 'string' || Array.isArray(a)) {
          return function (b) {
            return a.indexOf(b) !== -1;
          };
        } else if (typeof a === 'object' && a !== null) {
          return function (b) {
            return hasOwnProperty.call(a, b);
          };
        }
        return null;
      }
  
      function doQueryOp(val, op, record) {
        for (var p in op) {
          if (hasOwnProperty.call(op, p)) {
            return LokiOps[p](val, op[p], record);
          }
        }
        return false;
      }
  
      var LokiOps = {
        // comparison operators
        // a is the value in the collection
        // b is the query value
        $eq: function (a, b) {
          return a === b;
        },
  
        // abstract/loose equality
        $aeq: function (a, b) {
          return a == b;
        },
  
        $ne: function (a, b) {
          // ecma 5 safe test for NaN
          if (b !== b) {
            // ecma 5 test value is not NaN
            return (a === a);
          }
  
          return a !== b;
        },
        // date equality / loki abstract equality test
        $dteq: function (a, b) {
          return Comparators.aeq(a, b);
        },
  
        // loki comparisons: return identical unindexed results as indexed comparisons
        $gt: function (a, b) {
          return Comparators.gt(a, b, false);
        },
  
        $gte: function (a, b) {
          return Comparators.gt(a, b, true);
        },
  
        $lt: function (a, b) {
          return Comparators.lt(a, b, false);
        },
  
        $lte: function (a, b) {
          return Comparators.lt(a, b, true);
        },
  
        // lightweight javascript comparisons
        $jgt: function (a, b) {
          return a > b;
        },
  
        $jgte: function (a, b) {
          return a >= b;
        },
  
        $jlt: function (a, b) {
          return a < b;
        },
  
        $jlte: function (a, b) {
          return a <= b;
        },
  
        // ex : coll.find({'orderCount': {$between: [10, 50]}});
        $between: function (a, vals) {
          if (a === undefined || a === null) return false;
          return (Comparators.gt(a, vals[0], true) && Comparators.lt(a, vals[1], true));
        },
  
        $jbetween: function (a, vals) {
          if (a === undefined || a === null) return false;
          return (a >= vals[0] && a <= vals[1]);
        },
  
        $in: function (a, b) {
          return b.indexOf(a) !== -1;
        },
  
        $inSet: function(a, b) {
          return b.has(a);
        },
  
        $nin: function (a, b) {
          return b.indexOf(a) === -1;
        },
  
        $keyin: function (a, b) {
          return a in b;
        },
  
        $nkeyin: function (a, b) {
          return !(a in b);
        },
  
        $definedin: function (a, b) {
          return b[a] !== undefined;
        },
  
        $undefinedin: function (a, b) {
          return b[a] === undefined;
        },
  
        $regex: function (a, b) {
          return b.test(a);
        },
  
        $containsString: function (a, b) {
          return (typeof a === 'string') && (a.indexOf(b) !== -1);
        },
  
        $containsNone: function (a, b) {
          return !LokiOps.$containsAny(a, b);
        },
  
        $containsAny: function (a, b) {
          var checkFn = containsCheckFn(a);
          if (checkFn !== null) {
            return (Array.isArray(b)) ? (b.some(checkFn)) : (checkFn(b));
          }
          return false;
        },
  
        $contains: function (a, b) {
          var checkFn = containsCheckFn(a);
          if (checkFn !== null) {
            return (Array.isArray(b)) ? (b.every(checkFn)) : (checkFn(b));
          }
          return false;
        },
  
        $elemMatch: function (a, b) {
          if (Array.isArray(a)) {
            return a.some(function (item) {
              return Object.keys(b).every(function (property) {
                var filter = b[property];
                if (!(typeof filter === 'object' && filter)) {
                  filter = { $eq: filter };
                }
  
                if (property.indexOf('.') !== -1) {
                  return dotSubScan(item, property.split('.'), doQueryOp, b[property], item);
                }
                return doQueryOp(item[property], filter, item);
              });
            });
          }
          return false;
        },
  
        $type: function (a, b, record) {
          var type = typeof a;
          if (type === 'object') {
            if (Array.isArray(a)) {
              type = 'array';
            } else if (a instanceof Date) {
              type = 'date';
            }
          }
          return (typeof b !== 'object') ? (type === b) : doQueryOp(type, b, record);
        },
  
        $finite: function (a, b) {
          return (b === isFinite(a));
        },
  
        $size: function (a, b, record) {
          if (Array.isArray(a)) {
            return (typeof b !== 'object') ? (a.length === b) : doQueryOp(a.length, b, record);
          }
          return false;
        },
  
        $len: function (a, b, record) {
          if (typeof a === 'string') {
            return (typeof b !== 'object') ? (a.length === b) : doQueryOp(a.length, b, record);
          }
          return false;
        },
  
        $where: function (a, b) {
          return b(a) === true;
        },
  
        // field-level logical operators
        // a is the value in the collection
        // b is the nested query operation (for '$not')
        //   or an array of nested query operations (for '$and' and '$or')
        $not: function (a, b, record) {
          return !doQueryOp(a, b, record);
        },
  
        $and: function (a, b, record) {
          for (var idx = 0, len = b.length; idx < len; idx += 1) {
            if (!doQueryOp(a, b[idx], record)) {
              return false;
            }
          }
          return true;
        },
  
        $or: function (a, b, record) {
          for (var idx = 0, len = b.length; idx < len; idx += 1) {
            if (doQueryOp(a, b[idx], record)) {
              return true;
            }
          }
          return false;
        },
  
        $exists: function (a, b) {
          if (b) {
            return a !== undefined;
          } else {
            return a === undefined;
          }
        }
      };
  
      // ops that can be used with { $$op: 'column-name' } syntax
      var valueLevelOps = ['$eq', '$aeq', '$ne', '$dteq', '$gt', '$gte', '$lt', '$lte', '$jgt', '$jgte', '$jlt', '$jlte', '$type'];
      valueLevelOps.forEach(function (op) {
        var fun = LokiOps[op];
        LokiOps['$' + op] = function (a, spec, record) {
          if (typeof spec === 'string') {
            return fun(a, record[spec]);
          } else if (typeof spec === 'function') {
            return fun(a, spec(record));
          } else {
            throw new Error('Invalid argument to $$ matcher');
          }
        };
      });
  
      // if an op is registered in this object, our 'calculateRange' can use it with our binary indices.
      // if the op is registered to a function, we will run that function/op as a 2nd pass filter on results.
      // those 2nd pass filter functions should be similar to LokiOps functions, accepting 2 vals to compare.
      var indexedOps = {
        $eq: LokiOps.$eq,
        $aeq: true,
        $dteq: true,
        $gt: true,
        $gte: true,
        $lt: true,
        $lte: true,
        $in: true,
        $between: true
      };
  
      function clone(data, method) {
        if (data === null || data === undefined) {
          return null;
        }
  
        var cloneMethod = method || 'parse-stringify',
          cloned;
  
        switch (cloneMethod) {
          case "parse-stringify":
            cloned = JSON.parse(JSON.stringify(data));
            break;
          case "jquery-extend-deep":
            cloned = jQuery.extend(true, {}, data);
            break;
          case "shallow":
            // more compatible method for older browsers
            cloned = Object.create(data.constructor.prototype);
            Object.keys(data).map(function (i) {
              cloned[i] = data[i];
            });
            break;
          case "shallow-assign":
            // should be supported by newer environments/browsers
            cloned = Object.create(data.constructor.prototype);
            Object.assign(cloned, data);
            break;
          case "shallow-recurse-objects":
            // shallow clone top level properties
            cloned = clone(data, "shallow");
            var keys = Object.keys(data);
            // for each of the top level properties which are object literals, recursively shallow copy
            keys.forEach(function (key) {
              if (typeof data[key] === "object" && data[key].constructor.name === "Object") {
                cloned[key] = clone(data[key], "shallow-recurse-objects");
              } else if (Array.isArray(data[key])) {
                cloned[key] = cloneObjectArray(data[key], "shallow-recurse-objects");
              }
            });
            break;
          default:
            break;
        }
  
        return cloned;
      }
  
      function cloneObjectArray(objarray, method) {
        if (method == "parse-stringify") {
          return clone(objarray, method);
        }
        var result = [];
        for (var i = 0, len = objarray.length; i < len; i++) {
          result[i] = clone(objarray[i], method);
        }
        return result;
      }
  
     
  