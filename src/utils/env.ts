export enum ENV_TYPE {
    BROWSER = "BROWSER",
    NODEJS = 'NODEJS'
}

export const getENV = function () {
    // if (typeof global !== 'undefined' && (global?.android || global?.NSObject)) {
    //   // If no adapter assume nativescript which needs adapter to be passed manually
    //   return 'NATIVESCRIPT'; //nativescript
    // }

    if (typeof window === 'undefined') {
        return ENV_TYPE.NODEJS;
    } else {
        return ENV_TYPE.BROWSER
    }

    // if (typeof global !== 'undefined' && global.window && typeof process !== 'undefined') {
    //   return 'NODEJS'; //node-webkit
    // }

    // if (typeof document !== 'undefined') {
    //   if (document.URL.indexOf('http://') === -1 && document.URL.indexOf('https://') === -1) {
    //     return 'CORDOVA';
    //   }
    //   return 'BROWSER';
    // }
    // return 'CORDOVA';
};

