'use strict';

var app = angular.module('walmart-app',
  ['ngAnimate', 'ui.router', 'restangular', 'LocalStorageModule']);

// Use relative paths for github pages.
app.constant('PARTIALS_URL', './assets/partials/');

// Since we're exposing our API key, let's break it up so bots can't read it.
app.constant('WALMART_KEY', '8ks2tc' + 'fzcz38' + 'a5xtc8' + 'u67ujk');

// Walmart's API base url.
app.constant('WALMART_API', 'http://api.walmartlabs.com/v1/');


/********************************************************************
* APP CONFIGURATION
*********************************************************************/
app.config(function(
  $stateProvider, $urlRouterProvider, localStorageServiceProvider,
  PARTIALS_URL) {

  // CONFIGURE LOCAL STORAGE.
  localStorageServiceProvider.setPrefix('walmart-app');
  localStorageServiceProvider.setStorageType('localStorage');

  // UI-ROUTER STATES.
  $stateProvider.state('home', {
    url: '/',
    controller: 'HomeController',
    templateUrl: PARTIALS_URL + 'home.html'
  });

  $urlRouterProvider.otherwise('/');
});


/********************************************************************
* SERVICES
*********************************************************************/
app.service('WalmartRestangular', function(
  Restangular, WALMART_API, WALMART_KEY) {

  // Create a custom Restangular instance for Walmart JSONP requests.
  return Restangular.withConfig(function(RestangularConfigurer) {
    RestangularConfigurer.setBaseUrl(WALMART_API);
    RestangularConfigurer.setJsonp(true);
    RestangularConfigurer.setDefaultRequestParams('jsonp',
      { callback: 'JSON_CALLBACK' });
    RestangularConfigurer.setDefaultRequestParams({
      format: 'json',
      apiKey: WALMART_KEY
    });
  });
});


app.service('AlertService', function($timeout, $rootScope) {

  $rootScope.alerts = {
    success: {},
    warning: {},
    error: {}
  };

  this.alertTime = 3000;

  this.clearAlertTimeout = function(name, time) {
    $timeout(function() {
      $rootScope.alerts[name] = {};
    }, time || this.alertTime);
  };

  this.success = function(message, icon) {
    $rootScope.alerts.success.message = message;
    $rootScope.alerts.success.icon = icon;
    this.clearAlertTimeout('success');
  };

  this.warn = function(message, icon) {
    $rootScope.alerts.warning.message = message;
    $rootScope.alerts.warning.icon = icon;
    this.clearAlertTimeout('warning');
  };

  this.error = function(message, icon) {
    $rootScope.alerts.error.message = message;
    $rootScope.alerts.error.icon = icon;
    this.clearAlertTimeout('error');
  };
});


app.service('StorageService', function(localStorageService) {

  this.getItem = function(key) {
    return localStorageService.get(key);
  };

  this.getAllItems = function() {
    return _.map(localStorageService.keys(), function(key) {
      return localStorageService.get(key);
    });
  };

  this.getItemSet = function(items) {
    items = items || this.getAllItems();
    var set = {};
    for (var i=0; i<items.length; i++) {
      var item = items[i];
      if (!set[item.itemId]) {
        set[item.itemId] = item;
      }
    } return set;
  };

  this.setItem = function(key, value) {
    return localStorageService.set(key, value);
  };

  this.storeList = function(list, key) {
    for (var i=0; i<list.length; i++) {
      this.setItem(list[i][key], list[i]);
    }
  };

  this.removeItem = function(key) {
    return localStorageService.remove(key);
  };

  this.clearStorage = function(regex) {
    return localStorageService.clearAll(regex);
  };

});


/********************************************************************
* CONTROLLERS
*********************************************************************/
app.controller('HomeController', function (
  $scope, $window, WalmartRestangular, AlertService, StorageService) {

  // Used to store products and detect duplicate items.
  $scope.products = StorageService.getAllItems();
  $scope.productSet = StorageService.getItemSet($scope.products);

  // Controls other features.
  $scope.form = {};
  $scope.orderCriteria = 'name';
  $scope.orderReverse = false;
  $scope.isLoading = false;
  $scope.showAdvanced = true;
  $scope.sortCriteria = [
    { value: 'relevance', display: 'Relevance' },
    { value: 'price', display: 'Price' },
    { value: 'title', display: 'Title' },
    { value: 'bestseller', display: 'Best Seller' },
    { value: 'customerRating', display: 'Customer Rating' },
    { value: 'new', display: 'New' }
  ];

  $scope.toggleAdvanced = function() {
    $scope.showAdvanced = !$scope.showAdvanced;
  };

  $scope.setOrderCriteria = function(value) {
    var orderBefore = $scope.orderCriteria;
    if (orderBefore === value) {
      $scope.orderReverse = !$scope.orderReverse;
    } else {
      $scope.orderCriteria = value;
    }
  };

  $scope.submitForm = function(form) {
    if (!form.$valid) { return; }
    $scope.isLoading = true;

    // Clamp max number of items to 20 because of API constraints.
    $scope.form.numItems = $scope.form.numItems === undefined ? 10: $scope.form.numItems;
    var clampedNumItems = $scope.form.numItems <= 20 ? $scope.form.numItems : 20;

    var params = {
      query: $scope.form.query,
      sort: $scope.form.sortBy,
      start: $scope.form.startAt,
      numItems: clampedNumItems
    };

    // Brand params are slightly trickier with v1 API so do it here.
    if ($scope.form.brandName) {
      params.facet = 'on';
      params['facet.filter'] = 'brand:' + _.capitalize($scope.form.brandName);
    }

    // Send request to retrieve the search results.
    WalmartRestangular.one('search').get(params).then(function(data) {

      // Show alert if no results are found.
      if (!data.totalResults) {
        $scope.isLoading = false;
        AlertService.warn(data.message, 'fa-exclamation-triangle');
        return;
      }

      // Then retrieve the brand name from the product API.
      var results = data.items;
      var productIds = _.map(results, function(product) {
        return product.itemId;
      });

      // Make an additional API call to retrieve brand (supports 20 ids).
      WalmartRestangular.one('items').get({ids: productIds.join(',')})
      .then(function(products) {

        var duplicateItems = [];
        var newItems = [];

        // Add items, potentially ignoring duplicates based on user input.
        for (var i=0; i<results.length; i++) {
          var result = results[i];

          // Store brand and other potentially missing information.
          if (result.itemId === products.items[i].itemId) {
            result.brandName = products.items[i].brandName;
            result.salePrice = products.items[i].salePrice;
            result.msrp = products.items[i].msrp;
          }

          // Check if item is duplicate and add to appropriate array.
          if ($scope.productSet[result.itemId]) {
            duplicateItems.push(result);
          } else {
            newItems.push(result);
            $scope.productSet[result.itemId] = result;
          }
        }

        // Ask the user whether duplicate items should be stored.
        var addDuplicates;
        if (duplicateItems.length > 0) {
          addDuplicates = $window.confirm('There are ' +
            duplicateItems.length + ' duplicate items. Add them anyways?');
        }

        // Add duplicate items based on the user's response.
        if (addDuplicates) {
          newItems = newItems.concat(duplicateItems);
        }

        // Add new items to storage and refresh the table.
        StorageService.storeList(newItems, 'itemId');
        $scope.products = StorageService.getAllItems();
        $scope.isLoading = false;

        // Build and display the alert message.
        var message = 'Added ' + newItems.length + ' new items.';
        message += ' There were ' + duplicateItems.length + ' duplicates.';
        if (newItems.length > 0) {
          AlertService.success(message, 'fa-cart-plus');
        } else {
          AlertService.warn(message, 'fa-shopping-cart');
        }
      });
    });
  };

  $scope.removeProduct = function(product) {
    StorageService.removeItem(product.itemId);
    delete $scope.productSet[product.itemId];
    $scope.products = StorageService.getAllItems();
  };

  $scope.removeAllProducts = function() {
    var confirm = $window.confirm('Remove all items?');
    if (confirm) {
      StorageService.clearStorage();
      $scope.products = StorageService.getAllItems();
      $scope.productSet = StorageService.getItemSet($scope.products);
      AlertService.success('All products removed.', 'fa-trash');
    }
  };

});


/********************************************************************
* DIRECTIVES
*********************************************************************/
app.directive('appLoader', function() {
  return {
    restrict: 'E',
    replace: true,

    template: [
      '<div ng-if="isLoading" class="loader">',
      '<i class="fa fa-5x fa-refresh fa-spin"></i>',
      '</div>'
    ].join(' ')
  };
});

app.directive('appRatingStars', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: { rating: '@' }, // '@' represents one-way binding.

    controller: function($scope) {
      $scope.stars = [];
      var populateStars = function(count, value) {
        for (var i=0; i<count; i++) { $scope.stars.push(value); }
      };
      var numFullStars = Math.floor($scope.rating);
      var numHalfStars = ($scope.rating % 1) >= 0.5 ? 1 : 0;
      var numEmptyStars = 5 - numFullStars - numHalfStars;
      populateStars(numFullStars, 'full');
      populateStars(numHalfStars, 'half');
      populateStars(numEmptyStars, 'empty');
    },

    template: [
      '<span ng-repeat="n in stars track by $index">',
      '<i ng-if="n === \'full\'" class="fa fa-star"></i>',
      '<i ng-if="n === \'half\'" class="fa fa-star-half"></i>',
      '<i ng-if="n === \'empty\'" class="fa fa-star fa-star-empty"></i>',
      '</span>'
    ].join(' ')
  };
});

app.directive('appOrderCaret', function() {
  return {
    restrict: 'E',
    replace: true,
    scope: { criteria: '@' },

    template: [
      '<span>',
      '<i ng-if="$parent.orderCriteria === criteria && !$parent.orderReverse" class="fa fa-caret-down"></i>',
      '<i ng-if="$parent.orderCriteria === criteria && $parent.orderReverse" class="fa fa-caret-up"></i>',
      '</span>'
    ].join(' ')
  };
});
