    /**
     * General utils, including statistical functions
     */
     function isDeepProperty(field) {
        return field.indexOf('.') !== -1;
      }
  
      function parseBase10(num) {
        return parseFloat(num, 10);
      }
  
      function isNotUndefined(obj) {
        return obj !== undefined;
      }
  
      function add(a, b) {
        return a + b;
      }
  
      function sub(a, b) {
        return a - b;
      }
  
      function median(values) {
        values.sort(sub);
        var half = Math.floor(values.length / 2);
        return (values.length % 2) ? values[half] : ((values[half - 1] + values[half]) / 2.0);
      }
  
      function average(array) {
        return (array.reduce(add, 0)) / array.length;
      }
  
      function standardDeviation(values) {
        var avg = average(values);
        var squareDiffs = values.map(function (value) {
          var diff = value - avg;
          var sqrDiff = diff * diff;
          return sqrDiff;
        });
  
        var avgSquareDiff = average(squareDiffs);
  
        var stdDev = Math.sqrt(avgSquareDiff);
        return stdDev;
      }
  
      function deepProperty(obj, property, isDeep) {
        if (isDeep === false) {
          // pass without processing
          return obj[property];
        }
        var pieces = property.split('.'),
          root = obj;
        while (pieces.length > 0) {
          root = root[pieces.shift()];
        }
        return root;
      }
  
      function binarySearch(array, item, fun) {
        var lo = 0,
          hi = array.length,
          compared,
          mid;
        while (lo < hi) {
          mid = (lo + hi) >> 1;
          compared = fun.apply(null, [item, array[mid]]);
          if (compared === 0) {
            return {
              found: true,
              index: mid
            };
          } else if (compared < 0) {
            hi = mid;
          } else {
            lo = mid + 1;
          }
        }
        return {
          found: false,
          index: hi
        };
      }
  
      function BSonSort(fun) {
        return function (array, item) {
          return binarySearch(array, item, fun);
        };
      }
  