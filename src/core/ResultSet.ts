import { clone } from "../utils/clone";
import { dotSubScan } from "../utils/compare";
import { hasOwnProperty } from "../utils/helper";
import { Utils } from "../utils/objects";
import { indexedOps, LokiOps } from "./Operator";
import { Collection } from "./Collection";

/**
 * Resultset class allowing chainable queries.  Intended to be instanced internally.
 *    Collection.find(), Collection.where(), and Collection.chain() instantiate this.
 *
 * @example
 *    mycollection.chain()
 *      .find({ 'doors' : 4 })
 *      .where(function(obj) { return obj.name === 'Toyota' })
 *      .data();
 *
 * @constructor Resultset
 * @param {Collection} collection - The collection which this Resultset will query against.
 */
export function Resultset(collection, options?: any) {
  options = options || {};

  // retain reference to collection we are querying against
  this.collection = collection;
  this.filteredrows = [];
  this.filterInitialized = false;

  return this;
}

/**
 * reset() - Reset the resultset to its initial state.
 *
 * @returns {Resultset} Reference to this resultset, for future chain operations.
 */
Resultset.prototype.reset = function () {
  if (this.filteredrows.length > 0) {
    this.filteredrows = [];
  }
  this.filterInitialized = false;
  return this;
};

/**
 * toJSON() - Override of toJSON to avoid circular references
 *
 */
Resultset.prototype.toJSON = function () {
  var copy = this.copy();
  copy.collection = null;
  return copy;
};

/**
 * Allows you to limit the number of documents passed to next chain operation.
 *    A resultset copy() is made to avoid altering original resultset.
 *
 * @param {int} qty - The number of documents to return.
 * @returns {Resultset} Returns a copy of the resultset, limited by qty, for subsequent chain ops.
 * @memberof Resultset
 * // find the two oldest users
 * var result = users.chain().simplesort("age", true).limit(2).data();
 */
Resultset.prototype.limit = function (qty) {
  // if this has no filters applied, we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  var rscopy = new Resultset(this.collection);
  rscopy.filteredrows = this.filteredrows.slice(0, qty);
  rscopy.filterInitialized = true;
  return rscopy;
};

/**
 * Used for skipping 'pos' number of documents in the resultset.
 *
 * @param {int} pos - Number of documents to skip; all preceding documents are filtered out.
 * @returns {Resultset} Returns a copy of the resultset, containing docs starting at 'pos' for subsequent chain ops.
 * @memberof Resultset
 * // find everyone but the two oldest users
 * var result = users.chain().simplesort("age", true).offset(2).data();
 */
Resultset.prototype.offset = function (pos) {
  // if this has no filters applied, we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  var rscopy = new Resultset(this.collection);
  rscopy.filteredrows = this.filteredrows.slice(pos);
  rscopy.filterInitialized = true;
  return rscopy;
};

/**
 * copy() - To support reuse of resultset in branched query situations.
 *
 * @returns {Resultset} Returns a copy of the resultset (set) but the underlying document references will be the same.
 * @memberof Resultset
 */
Resultset.prototype.copy = function () {
  var result = new Resultset(this.collection);

  if (this.filteredrows.length > 0) {
    result.filteredrows = this.filteredrows.slice();
  }
  result.filterInitialized = this.filterInitialized;

  return result;
};

/**
 * Alias of copy()
 * @memberof Resultset
 */
Resultset.prototype.branch = Resultset.prototype.copy;

/**
 * transform() - executes a named collection transform or raw array of transform steps against the resultset.
 *
 * @param transform {(string|array)} - name of collection transform or raw transform array
 * @param parameters {object=} - (Optional) object property hash of parameters, if the transform requires them.
 * @returns {Resultset} either (this) resultset or a clone of of this resultset (depending on steps)
 * @memberof Resultset
 * @example
 * users.addTransform('CountryFilter', [
 *   {
 *     type: 'find',
 *     value: {
 *       'country': { $eq: '[%lktxp]Country' }
 *     }
 *   },
 *   {
 *     type: 'simplesort',
 *     property: 'age',
 *     options: { desc: false}
 *   }
 * ]);
 * var results = users.chain().transform("CountryFilter", { Country: 'fr' }).data();
 */
Resultset.prototype.transform = function (transform, parameters) {
  var idx,
    step,
    rs = this;

  // if transform is name, then do lookup first
  if (typeof transform === 'string') {
    if (this.collection.transforms.hasOwnProperty(transform)) {
      transform = this.collection.transforms[transform];
    }
  }

  // either they passed in raw transform array or we looked it up, so process
  if (typeof transform !== 'object' || !Array.isArray(transform)) {
    throw new Error("Invalid transform");
  }

  if (typeof parameters !== 'undefined') {
    transform = Utils.resolveTransformParams(transform, parameters);
  }

  for (idx = 0; idx < transform.length; idx++) {
    step = transform[idx];

    switch (step.type) {
      case "find":
        rs.find(step.value);
        break;
      case "where":
        rs.where(step.value);
        break;
      case "simplesort":
        rs.simplesort(step.property, step.desc || step.options);
        break;
      case "compoundsort":
        rs.compoundsort(step.value);
        break;
      case "sort":
        rs.sort(step.value);
        break;
      case "limit":
        rs = rs.limit(step.value);
        break; // limit makes copy so update reference
      case "offset":
        rs = rs.offset(step.value);
        break; // offset makes copy so update reference
      case "map":
        rs = rs.map(step.value, step.dataOptions);
        break;
      case "eqJoin":
        rs = rs.eqJoin(step.joinData, step.leftJoinKey, step.rightJoinKey, step.mapFun, step.dataOptions);
        break;
      // following cases break chain by returning array data so make any of these last in transform steps
      case "mapReduce":
        rs = rs.mapReduce(step.mapFunction, step.reduceFunction);
        break;
      // following cases update documents in current filtered resultset (use carefully)
      case "update":
        rs.update(step.value);
        break;
      case "remove":
        rs.remove();
        break;
      default:
        break;
    }
  }

  return rs;
};

/**
 * User supplied compare function is provided two documents to compare. (chainable)
 * @example
 *    rslt.sort(function(obj1, obj2) {
 *      if (obj1.name === obj2.name) return 0;
 *      if (obj1.name > obj2.name) return 1;
 *      if (obj1.name < obj2.name) return -1;
 *    });
 *
 * @param {function} comparefun - A javascript compare function used for sorting.
 * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
 * @memberof Resultset
 */
Resultset.prototype.sort = function (comparefun) {
  // if this has no filters applied, just we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  var wrappedComparer =
    (function (userComparer, data) {
      return function (a, b) {
        return userComparer(data[a], data[b]);
      };
    })(comparefun, this.collection.data);

  this.filteredrows.sort(wrappedComparer);

  return this;
};

/**
 * Simpler, loose evaluation for user to sort based on a property name. (chainable).
 *    Sorting based on the same lt/gt helper functions used for binary indices.
 *
 * @param {string} propname - name of property to sort by.
 * @param {object|bool=} options - boolean to specify if isdescending, or options object
 * @param {boolean} [options.desc=false] - whether to sort descending
 * @param {boolean} [options.disableIndexIntersect=false] - whether we should explicity not use array intersection.
 * @param {boolean} [options.forceIndexIntersect=false] - force array intersection (if binary index exists).
 * @param {boolean} [options.useJavascriptSorting=false] - whether results are sorted via basic javascript sort.
 * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
 * @memberof Resultset
 * @example
 * var results = users.chain().simplesort('age').data();
 */
Resultset.prototype.simplesort = function (propname, options) {
  var eff,
    targetEff = 10,
    dc = this.collection.data.length,
    frl = this.filteredrows.length,
    hasBinaryIndex = this.collection.binaryIndices.hasOwnProperty(propname);

  if (typeof (options) === 'undefined' || options === false) {
    options = { desc: false };
  }
  if (options === true) {
    options = { desc: true };
  }

  // if nothing in filtered rows array...
  if (frl === 0) {
    // if the filter is initialized to be empty resultset, do nothing
    if (this.filterInitialized) {
      return this;
    }

    // otherwise no filters applied implies all documents, so we need to populate filteredrows first

    // if we have a binary index, we can just use that instead of sorting (again)
    if (this.collection.binaryIndices.hasOwnProperty(propname)) {
      // make sure index is up-to-date
      this.collection.ensureIndex(propname);
      // copy index values into filteredrows
      this.filteredrows = this.collection.binaryIndices[propname].values.slice(0);

      if (options.desc) {
        this.filteredrows.reverse();
      }

      // we are done, return this (resultset) for further chain ops
      return this;
    }
    // otherwise initialize array for sort below
    else {
      // build full document index (to be sorted subsequently)
      this.filteredrows = this.collection.prepareFullDocIndex();
    }
  }
  // otherwise we had results to begin with, see if we qualify for index intercept optimization
  else {

    // If already filtered, but we want to leverage binary index on sort.
    // This will use custom array intection algorithm.
    if (!options.disableIndexIntersect && hasBinaryIndex) {

      // calculate filter efficiency
      eff = dc / frl;

      // when javascript sort fallback is enabled, you generally need more than ~17% of total docs in resultset
      // before array intersect is determined to be the faster algorithm, otherwise leave at 10% for loki sort.
      if (options.useJavascriptSorting) {
        targetEff = 6;
      }

      // anything more than ratio of 10:1 (total documents/current results) should use old sort code path
      // So we will only use array intersection if you have more than 10% of total docs in your current resultset.
      if (eff <= targetEff || options.forceIndexIntersect) {
        var idx, fr = this.filteredrows;
        var io = {};
        // set up hashobject for simple 'inclusion test' with existing (filtered) results
        for (idx = 0; idx < frl; idx++) {
          io[fr[idx]] = true;
        }
        // grab full sorted binary index array
        var pv = this.collection.binaryIndices[propname].values;

        // filter by existing results
        this.filteredrows = pv.filter(function (n) { return io[n]; });

        if (options.desc) {
          this.filteredrows.reverse();
        }

        return this;
      }
    }
  }

  // at this point, we will not be able to leverage binary index so we will have to do an array sort

  // if we have opted to use simplified javascript comparison function...
  if (options.useJavascriptSorting) {
    return this.sort(function (obj1, obj2) {
      if (obj1[propname] === obj2[propname]) return 0;
      if (obj1[propname] > obj2[propname]) return 1;
      if (obj1[propname] < obj2[propname]) return -1;
    });
  }

  // otherwise use loki sort which will return same results if column is indexed or not
  var wrappedComparer =
    (function (prop, desc, data) {
      var val1, val2, arr;
      return function (a, b) {
        if (~prop.indexOf('.')) {
          arr = prop.split('.');
          val1 = Utils.getIn(data[a], arr, true);
          val2 = Utils.getIn(data[b], arr, true);
        } else {
          val1 = data[a][prop];
          val2 = data[b][prop];
        }
        return sortHelper(val1, val2, desc);
      };
    })(propname, options.desc, this.collection.data);

  this.filteredrows.sort(wrappedComparer);

  return this;
};

/**
 * Allows sorting a resultset based on multiple columns.
 * @example
 * // to sort by age and then name (both ascending)
 * rs.compoundsort(['age', 'name']);
 * // to sort by age (ascending) and then by name (descending)
 * rs.compoundsort(['age', ['name', true]]);
 *
 * @param {array} properties - array of property names or subarray of [propertyname, isdesc] used evaluate sort order
 * @returns {Resultset} Reference to this resultset, sorted, for future chain operations.
 * @memberof Resultset
 */
Resultset.prototype.compoundsort = function (properties) {
  if (properties.length === 0) {
    throw new Error("Invalid call to compoundsort, need at least one property");
  }

  var prop;
  if (properties.length === 1) {
    prop = properties[0];
    if (Array.isArray(prop)) {
      return this.simplesort(prop[0], prop[1]);
    }
    return this.simplesort(prop, false);
  }

  // unify the structure of 'properties' to avoid checking it repeatedly while sorting
  for (var i = 0, len = properties.length; i < len; i += 1) {
    prop = properties[i];
    if (!Array.isArray(prop)) {
      properties[i] = [prop, false];
    }
  }

  // if this has no filters applied, just we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  var wrappedComparer =
    (function (props, data) {
      return function (a, b) {
        return compoundeval(props, data[a], data[b]);
      };
    })(properties, this.collection.data);

  this.filteredrows.sort(wrappedComparer);

  return this;
};

/**
 * findOr() - oversee the operation of OR'ed query expressions.
 *    OR'ed expression evaluation runs each expression individually against the full collection,
 *    and finally does a set OR on each expression's results.
 *    Each evaluation can utilize a binary index to prevent multiple linear array scans.
 *
 * @param {array} expressionArray - array of expressions
 * @returns {Resultset} this resultset for further chain ops.
 */
Resultset.prototype.findOr = function (expressionArray) {
  var fr = null,
    fri = 0,
    frlen = 0,
    docset = [],
    idxset = [],
    idx = 0,
    origCount = this.count();

  // If filter is already initialized, then we query against only those items already in filter.
  // This means no index utilization for fields, so hopefully its filtered to a smallish filteredrows.
  for (var ei = 0, elen = expressionArray.length; ei < elen; ei++) {
    // we need to branch existing query to run each filter separately and combine results
    fr = this.branch().find(expressionArray[ei]).filteredrows;
    frlen = fr.length;

    // add any document 'hits'
    for (fri = 0; fri < frlen; fri++) {
      idx = fr[fri];
      if (idxset[idx] === undefined) {
        idxset[idx] = true;
        docset.push(idx);
      }
    }
  }

  this.filteredrows = docset;
  this.filterInitialized = true;

  return this;
};
Resultset.prototype.$or = Resultset.prototype.findOr;

// precompile recursively
function precompileQuery(operator, value) {
  // for regex ops, precompile
  if (operator === '$regex') {
    if (Array.isArray(value)) {
      value = new RegExp(value[0], value[1]);
    } else if (!(value instanceof RegExp)) {
      value = new RegExp(value);
    }
  }
  else if (typeof value === 'object') {
    for (var key in value) {
      if (key === '$regex' || typeof value[key] === 'object') {
        value[key] = precompileQuery(key, value[key]);
      }
    }
  }

  return value;
}

/**
 * findAnd() - oversee the operation of AND'ed query expressions.
 *    AND'ed expression evaluation runs each expression progressively against the full collection,
 *    internally utilizing existing chained resultset functionality.
 *    Only the first filter can utilize a binary index.
 *
 * @param {array} expressionArray - array of expressions
 * @returns {Resultset} this resultset for further chain ops.
 */
Resultset.prototype.findAnd = function (expressionArray) {
  // we have already implementing method chaining in this (our Resultset class)
  // so lets just progressively apply user supplied and filters
  for (var i = 0, len = expressionArray.length; i < len; i++) {
    if (this.count() === 0) {
      return this;
    }
    this.find(expressionArray[i]);
  }
  return this;
};
Resultset.prototype.$and = Resultset.prototype.findAnd;

/**
 * Used for querying via a mongo-style query object.
 *
 * @param {object} query - A mongo-style query object used for filtering current results.
 * @param {boolean=} firstOnly - (Optional) Used by collection.findOne()
 * @returns {Resultset} this resultset for further chain ops.
 * @memberof Resultset
 * @example
 * var over30 = users.chain().find({ age: { $gte: 30 } }).data();
 */
Resultset.prototype.find = function (query, firstOnly) {
  if (this.collection.data.length === 0) {
    this.filteredrows = [];
    this.filterInitialized = true;
    return this;
  }

  var queryObject = query || 'getAll',
    p,
    property,
    queryObjectOp,
    obj,
    operator,
    value,
    key,
    searchByIndex = false,
    result = [],
    filters = [],
    index = null;

  // flag if this was invoked via findOne()
  firstOnly = firstOnly || false;

  if (typeof queryObject === 'object') {
    for (p in queryObject) {
      obj = {};
      obj[p] = queryObject[p];
      filters.push(obj);

      if (hasOwnProperty.call(queryObject, p)) {
        property = p;
        queryObjectOp = queryObject[p];
      }
    }
    // if more than one expression in single query object,
    // convert implicit $and to explicit $and
    if (filters.length > 1) {
      return this.find({ '$and': filters }, firstOnly);
    }
  }

  // apply no filters if they want all
  if (!property || queryObject === 'getAll') {
    if (firstOnly) {
      if (this.filterInitialized) {
        this.filteredrows = this.filteredrows.slice(0, 1);
      } else {
        this.filteredrows = (this.collection.data.length > 0) ? [0] : [];
        this.filterInitialized = true;
      }
    }

    return this;
  }

  // injecting $and and $or expression tree evaluation here.
  if (property === '$and' || property === '$or') {
    this[property](queryObjectOp);

    // for chained find with firstonly,
    if (firstOnly && this.filteredrows.length > 1) {
      this.filteredrows = this.filteredrows.slice(0, 1);
    }

    return this;
  }

  // see if query object is in shorthand mode (assuming eq operator)
  if (queryObjectOp === null || (typeof queryObjectOp !== 'object' || queryObjectOp instanceof Date)) {
    operator = '$eq';
    value = queryObjectOp;
  } else if (typeof queryObjectOp === 'object') {
    for (key in queryObjectOp) {
      if (hasOwnProperty.call(queryObjectOp, key)) {
        operator = key;
        value = queryObjectOp[key];
        break;
      }
    }
  } else {
    throw new Error('Do not know what you want to do.');
  }

  if (operator === '$regex' || typeof value === 'object') {
    value = precompileQuery(operator, value);
  }

  // if user is deep querying the object such as find('name.first': 'odin')
  var usingDotNotation = (property.indexOf('.') !== -1);

  // if an index exists for the property being queried against, use it
  // for now only enabling where it is the first filter applied and prop is indexed
  var doIndexCheck = !this.filterInitialized;

  if (doIndexCheck && this.collection.binaryIndices[property] && indexedOps[operator]) {
    // this is where our lazy index rebuilding will take place
    // basically we will leave all indexes dirty until we need them
    // so here we will rebuild only the index tied to this property
    // ensureIndex() will only rebuild if flagged as dirty since we are not passing force=true param
    if (this.collection.adaptiveBinaryIndices !== true) {
      this.collection.ensureIndex(property);
    }

    searchByIndex = true;
    index = this.collection.binaryIndices[property];
  }

  // opportunistically speed up $in searches from O(n*m) to O(n*log m)
  if (!searchByIndex && operator === '$in' && Array.isArray(value) && typeof Set !== 'undefined') {
    value = new Set(value);
    operator = '$inSet';
  }

  // the comparison function
  var fun = LokiOps[operator];

  // "shortcut" for collection data
  var t = this.collection.data;
  // filter data length
  var i = 0,
    len = 0;

  // Query executed differently depending on :
  //    - whether the property being queried has an index defined
  //    - if chained, we handle first pass differently for initial filteredrows[] population
  //
  // For performance reasons, each case has its own if block to minimize in-loop calculations

  var filter, rowIdx = 0, record;

  // If the filteredrows[] is already initialized, use it
  if (this.filterInitialized) {
    filter = this.filteredrows;
    len = filter.length;

    // currently supporting dot notation for non-indexed conditions only
    if (usingDotNotation) {
      property = property.split('.');
      for (i = 0; i < len; i++) {
        rowIdx = filter[i];
        record = t[rowIdx];
        if (dotSubScan(record, property, fun, value, record)) {
          result.push(rowIdx);
          if (firstOnly) {
            this.filteredrows = result;
            return this;
          }
        }
      }
    } else {
      for (i = 0; i < len; i++) {
        rowIdx = filter[i];
        record = t[rowIdx];
        if (fun(record[property], value, record)) {
          result.push(rowIdx);
          if (firstOnly) {
            this.filteredrows = result;
            return this;
          }
        }
      }
    }
  }
  // first chained query so work against data[] but put results in filteredrows
  else {
    // if not searching by index
    if (!searchByIndex) {
      len = t.length;

      if (usingDotNotation) {
        property = property.split('.');
        for (i = 0; i < len; i++) {
          record = t[i];
          if (dotSubScan(record, property, fun, value, record)) {
            result.push(i);
            if (firstOnly) {
              this.filteredrows = result;
              this.filterInitialized = true;
              return this;
            }
          }
        }
      } else {
        for (i = 0; i < len; i++) {
          record = t[i];
          if (fun(record[property], value, record)) {
            result.push(i);
            if (firstOnly) {
              this.filteredrows = result;
              this.filterInitialized = true;
              return this;
            }
          }
        }
      }
    } else {
      // search by index
      var segm = this.collection.calculateRange(operator, property, value);

      if (operator !== '$in') {
        for (i = segm[0]; i <= segm[1]; i++) {
          if (indexedOps[operator] !== true) {
            // must be a function, implying 2nd phase filtering of results from calculateRange
            if (indexedOps[operator](Utils.getIn(t[index.values[i]], property, usingDotNotation), value)) {
              result.push(index.values[i]);
              if (firstOnly) {
                this.filteredrows = result;
                this.filterInitialized = true;
                return this;
              }
            }
          }
          else {
            result.push(index.values[i]);
            if (firstOnly) {
              this.filteredrows = result;
              this.filterInitialized = true;
              return this;
            }
          }
        }
      } else {
        for (i = 0, len = segm.length; i < len; i++) {
          result.push(index.values[segm[i]]);
          if (firstOnly) {
            this.filteredrows = result;
            this.filterInitialized = true;
            return this;
          }
        }
      }
    }

  }

  this.filteredrows = result;
  this.filterInitialized = true; // next time work against filteredrows[]
  return this;
};


/**
 * where() - Used for filtering via a javascript filter function.
 *
 * @param {function} fun - A javascript function used for filtering current results by.
 * @returns {Resultset} this resultset for further chain ops.
 * @memberof Resultset
 * @example
 * var over30 = users.chain().where(function(obj) { return obj.age >= 30; }.data();
 */
Resultset.prototype.where = function (fun) {
  var viewFunction,
    result = [];

  if ('function' === typeof fun) {
    viewFunction = fun;
  } else {
    throw new TypeError('Argument is not a stored view or a function');
  }
  try {
    // If the filteredrows[] is already initialized, use it
    if (this.filterInitialized) {
      var j = this.filteredrows.length;

      while (j--) {
        if (viewFunction(this.collection.data[this.filteredrows[j]]) === true) {
          result.push(this.filteredrows[j]);
        }
      }

      this.filteredrows = result;

      return this;
    }
    // otherwise this is initial chained op, work against data, push into filteredrows[]
    else {
      var k = this.collection.data.length;

      while (k--) {
        if (viewFunction(this.collection.data[k]) === true) {
          result.push(k);
        }
      }

      this.filteredrows = result;
      this.filterInitialized = true;

      return this;
    }
  } catch (err) {
    throw err;
  }
};

/**
 * count() - returns the number of documents in the resultset.
 *
 * @returns {number} The number of documents in the resultset.
 * @memberof Resultset
 * @example
 * var over30Count = users.chain().find({ age: { $gte: 30 } }).count();
 */
Resultset.prototype.count = function () {
  if (this.filterInitialized) {
    return this.filteredrows.length;
  }
  return this.collection.count();
};

/**
 * Terminates the chain and returns array of filtered documents
 *
 * @param {object=} options - allows specifying 'forceClones' and 'forceCloneMethod' options.
 * @param {boolean} options.forceClones - Allows forcing the return of cloned objects even when
 *        the collection is not configured for clone object.
 * @param {string} options.forceCloneMethod - Allows overriding the default or collection specified cloning method.
 *        Possible values include 'parse-stringify', 'jquery-extend-deep', 'shallow', 'shallow-assign'
 * @param {bool} options.removeMeta - Will force clones and strip $loki and meta properties from documents
 *
 * @returns {array} Array of documents in the resultset
 * @memberof Resultset
 * @example
 * var resutls = users.chain().find({ age: 34 }).data();
 */
Resultset.prototype.data = function (options) {
  var result = [],
    data = this.collection.data,
    obj,
    len,
    i,
    method;

  options = options || {};

  // if user opts to strip meta, then force clones and use 'shallow' if 'force' options are not present
  if (options.removeMeta && !options.forceClones) {
    options.forceClones = true;
    options.forceCloneMethod = options.forceCloneMethod || 'shallow';
  }

  // if collection has delta changes active, then force clones and use 'parse-stringify' for effective change tracking of nested objects
  // if collection is immutable freeze and unFreeze takes care of cloning
  if (!this.collection.disableDeltaChangesApi && this.collection.disableFreeze) {
    options.forceClones = true;
    options.forceCloneMethod = 'parse-stringify';
  }

  // if this has no filters applied, just return collection.data
  if (!this.filterInitialized) {
    if (this.filteredrows.length === 0) {
      // determine whether we need to clone objects or not
      if (this.collection.cloneObjects || options.forceClones) {
        len = data.length;
        method = options.forceCloneMethod || this.collection.cloneMethod;
        for (i = 0; i < len; i++) {
          obj = clone(data[i], method);
          if (options.removeMeta) {
            delete obj.$loki;
            delete obj.meta;
          }
          result.push(obj);
        }
        return result;
      }
      // otherwise we are not cloning so return sliced array with same object references
      else {
        return data.slice();
      }
    } else {
      // filteredrows must have been set manually, so use it
      this.filterInitialized = true;
    }
  }

  var fr = this.filteredrows;
  len = fr.length;

  if (this.collection.cloneObjects || options.forceClones) {
    method = options.forceCloneMethod || this.collection.cloneMethod;
    for (i = 0; i < len; i++) {
      obj = clone(data[fr[i]], method);
      if (options.removeMeta) {
        delete obj.$loki;
        delete obj.meta;
      }
      result.push(obj);
    }
  } else {
    for (i = 0; i < len; i++) {
      result.push(data[fr[i]]);
    }
  }
  return result;
};

/**
 * Used to run an update operation on all documents currently in the resultset.
 *
 * @param {function} updateFunction - User supplied updateFunction(obj) will be executed for each document object.
 * @returns {Resultset} this resultset for further chain ops.
 * @memberof Resultset
 * @example
 * users.chain().find({ country: 'de' }).update(function(user) {
 *   user.phoneFormat = "+49 AAAA BBBBBB";
 * });
 */
Resultset.prototype.update = function (updateFunction) {

  if (typeof (updateFunction) !== "function") {
    throw new TypeError('Argument is not a function');
  }

  // if this has no filters applied, we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  var obj, len = this.filteredrows.length,
    rcd = this.collection.data;

  // pass in each document object currently in resultset to user supplied updateFunction
  for (var idx = 0; idx < len; idx++) {
    // if we have cloning option specified or are doing differential delta changes, clone object first
    if (!this.disableFreeze || this.collection.cloneObjects || !this.collection.disableDeltaChangesApi) {
      obj = clone(rcd[this.filteredrows[idx]], this.collection.cloneMethod);
      updateFunction(obj);
      this.collection.update(obj);
    }
    else {
      // no need to clone, so just perform update on collection data object instance
      updateFunction(rcd[this.filteredrows[idx]]);
      this.collection.update(rcd[this.filteredrows[idx]]);
    }
  }

  return this;
};

/**
 * Removes all document objects which are currently in resultset from collection (as well as resultset)
 *
 * @returns {Resultset} this (empty) resultset for further chain ops.
 * @memberof Resultset
 * @example
 * // remove users inactive since 1/1/2001
 * users.chain().find({ lastActive: { $lte: new Date("1/1/2001").getTime() } }).remove();
 */
Resultset.prototype.remove = function () {

  // if this has no filters applied, we need to populate filteredrows first
  if (!this.filterInitialized && this.filteredrows.length === 0) {
    this.filteredrows = this.collection.prepareFullDocIndex();
  }

  this.collection.removeBatchByPositions(this.filteredrows);

  this.filteredrows = [];

  return this;
};

/**
 * data transformation via user supplied functions
 *
 * @param {function} mapFunction - this function accepts a single document for you to transform and return
 * @param {function} reduceFunction - this function accepts many (array of map outputs) and returns single value
 * @returns {value} The output of your reduceFunction
 * @memberof Resultset
 * @example
 * var db = new loki("order.db");
 * var orders = db.addCollection("orders");
 * orders.insert([{ qty: 4, unitCost: 100.00 }, { qty: 10, unitCost: 999.99 }, { qty: 2, unitCost: 49.99 }]);
 *
 * function mapfun (obj) { return obj.qty*obj.unitCost };
 * function reducefun(array) {
 *   var grandTotal=0;
 *   array.forEach(function(orderTotal) { grandTotal += orderTotal; });
 *   return grandTotal;
 * }
 * var grandOrderTotal = orders.chain().mapReduce(mapfun, reducefun);
 * console.log(grandOrderTotal);
 */
Resultset.prototype.mapReduce = function (mapFunction, reduceFunction) {
  try {
    return reduceFunction(this.data().map(mapFunction));
  } catch (err) {
    throw err;
  }
};

/**
 * eqJoin() - Left joining two sets of data. Join keys can be defined or calculated properties
 * eqJoin expects the right join key values to be unique.  Otherwise left data will be joined on the last joinData object with that key
 * @param {Array|Resultset|Collection} joinData - Data array to join to.
 * @param {(string|function)} leftJoinKey - Property name in this result set to join on or a function to produce a value to join on
 * @param {(string|function)} rightJoinKey - Property name in the joinData to join on or a function to produce a value to join on
 * @param {function=} mapFun - (Optional) A function that receives each matching pair and maps them into output objects - function(left,right){return joinedObject}
 * @param {object=} dataOptions - options to data() before input to your map function
 * @param {bool} dataOptions.removeMeta - allows removing meta before calling mapFun
 * @param {boolean} dataOptions.forceClones - forcing the return of cloned objects to your map object
 * @param {string} dataOptions.forceCloneMethod - Allows overriding the default or collection specified cloning method.
 * @returns {Resultset} A resultset with data in the format [{left: leftObj, right: rightObj}]
 * @memberof Resultset
 * @example
 * var db = new loki('sandbox.db');
 *
 * var products = db.addCollection('products');
 * var orders = db.addCollection('orders');
 *
 * products.insert({ productId: "100234", name: "flywheel energy storage", unitCost: 19999.99 });
 * products.insert({ productId: "140491", name: "300F super capacitor", unitCost: 129.99 });
 * products.insert({ productId: "271941", name: "fuel cell", unitCost: 3999.99 });
 * products.insert({ productId: "174592", name: "390V 3AH lithium bank", unitCost: 4999.99 });
 *
 * orders.insert({ orderDate : new Date("12/1/2017").getTime(), prodId: "174592", qty: 2, customerId: 2 });
 * orders.insert({ orderDate : new Date("4/15/2016").getTime(), prodId: "271941", qty: 1, customerId: 1 });
 * orders.insert({ orderDate : new Date("3/12/2017").getTime(), prodId: "140491", qty: 4, customerId: 4 });
 * orders.insert({ orderDate : new Date("7/31/2017").getTime(), prodId: "100234", qty: 7, customerId: 3 });
 * orders.insert({ orderDate : new Date("8/3/2016").getTime(), prodId: "174592", qty: 3, customerId: 5 });
 *
 * var mapfun = function(left, right) {
 *   return {
 *     orderId: left.$loki,
 *     orderDate: new Date(left.orderDate) + '',
 *     customerId: left.customerId,
 *     qty: left.qty,
 *     productId: left.prodId,
 *     prodName: right.name,
 *     prodCost: right.unitCost,
 *     orderTotal: +((right.unitCost * left.qty).toFixed(2))
 *   };
 * };
 *
 * // join orders with relevant product info via eqJoin
 * var orderSummary = orders.chain().eqJoin(products, "prodId", "productId", mapfun).data();
 *
 * console.log(orderSummary);
 */
Resultset.prototype.eqJoin = function (joinData: any, leftJoinKey, rightJoinKey, mapFun, dataOptions) {

  var leftData = [],
    leftDataLength,
    rightData = [],
    rightDataLength,
    key,
    result = [],
    leftKeyisFunction = typeof leftJoinKey === 'function',
    rightKeyisFunction = typeof rightJoinKey === 'function',
    joinMap = {};

  //get the left data
  leftData = this.data(dataOptions);
  leftDataLength = leftData.length;

  //get the right data
  if (joinData instanceof Collection) {
    rightData = joinData.chain().data(dataOptions);
  } else if (joinData instanceof Resultset) {
    rightData = joinData.data(dataOptions);
  } else if (Array.isArray(joinData)) {
    rightData = joinData;
  } else {
    throw new TypeError('joinData needs to be an array or result set');
  }
  rightDataLength = rightData.length;

  //construct a lookup table

  for (var i = 0; i < rightDataLength; i++) {
    key = rightKeyisFunction ? rightJoinKey(rightData[i]) : rightData[i][rightJoinKey];
    joinMap[key] = rightData[i];
  }

  if (!mapFun) {
    mapFun = function (left, right) {
      return {
        left: left,
        right: right
      };
    };
  }

  //Run map function over each object in the resultset
  for (var j = 0; j < leftDataLength; j++) {
    key = leftKeyisFunction ? leftJoinKey(leftData[j]) : leftData[j][leftJoinKey];
    result.push(mapFun(leftData[j], joinMap[key] || {}));
  }

  //return return a new resultset with no filters
  this.collection = new Collection('joinData');
  this.collection.insert(result);
  this.filteredrows = [];
  this.filterInitialized = false;

  return this;
};

/**
 * Applies a map function into a new collection for further chaining.
 * @param {function} mapFun - javascript map function
 * @param {object=} dataOptions - options to data() before input to your map function
 * @param {bool} dataOptions.removeMeta - allows removing meta before calling mapFun
 * @param {boolean} dataOptions.forceClones - forcing the return of cloned objects to your map object
 * @param {string} dataOptions.forceCloneMethod - Allows overriding the default or collection specified cloning method.
 * @memberof Resultset
 * @example
 * var orders.chain().find({ productId: 32 }).map(function(obj) {
 *   return {
 *     orderId: $loki,
 *     productId: productId,
 *     quantity: qty
 *   };
 * });
 */
Resultset.prototype.map = function (mapFun, dataOptions) {
  var data = this.data(dataOptions).map(mapFun);
  //return return a new resultset with no filters
  this.collection = new Collection('mappedData');
  this.collection.insert(data);
  this.filteredrows = [];
  this.filterInitialized = false;

  return this;
};
