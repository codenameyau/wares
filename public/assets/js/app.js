'use strict';

var app = angular.module('walmart-app',
  ['ngAnimate', 'ui.router', 'restangular', 'LocalStorageModule']);

// Use relative paths for github pages.
app.constant('PARTIALS_URL', '../assets/partials/');

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

  this.setItem = function(key, value) {
    return localStorageService.set(key, value);
  };

  this.removeItem = function(key) {
    return localStorageService.remove(key);
  };

  this.clearStorage = function(regex) {
    return localStorageService.clearAll(regex);
  };

});

app.service('ProductService', function(StorageService) {
  // Make products an object to check for duplicate entries.
  this.products = {};

  this.loadItems = function() {
    var items = StorageService.getAllItems();
    for (var i=0; i<items.length; i++) {
      var item = items[i];
      this.products[item.itemId] = item;
    }
  };

  // Returns a boolean of whether the item was added.
  this.addItem = function(item, addDuplicates) {
    var itemInProducts = this.products[item.itemId];
    var itemAdded = false;
    if (itemInProducts && addDuplicates) {
      itemInProducts.quantity++;
      itemAdded = true;
    } else if (!itemInProducts) {
      item.quantity = 1;
      this.products[item.itemId] = item;
      StorageService.setItem(item.itemId, item);
      itemAdded = true;
    }
    return itemAdded;
  };

  // Returns the number of items added.
  this.addItems = function(items, addDuplicates) {
    var numItemsAdded = 0;
    for (var i=0; i<items.length; i++) {
      var itemAdded = this.addItem(items[i], addDuplicates);
      if (itemAdded) {
        numItemsAdded++;
      }
    }
    return numItemsAdded;
  };

  // Returns a boolean of whether the item was removed.
  this.removeItem = function(itemId) {
    var item = this.products[itemId];
    if (item) {
      item.quantity--;

      if (item.quanity < 1) {
        delete this.products[item];
        StorageService.removeItem(itemId);
      } else {
        StorageService.setItem(item.itemId, item);
      }
    }
  };

  this.removeAllItems = function() {
    StorageService.clearStorage();
    this.products = {};
  };

});


/********************************************************************
* CONTROLLERS
*********************************************************************/
app.controller('HomeController', function (
  $scope, $window, WalmartRestangular, AlertService, ProductService) {

  // Load the products from local storage.
  ProductService.loadItems();
  $scope.products = ProductService.products;

  // Instantiate variables to controls features.
  $scope.orderCriteria = 'name';
  $scope.orderReverse = false;
  $scope.isLoading = false;
  $scope.hideAdvanced = false;
  $scope.sortCriteria = [
    { value: 'relevance', display: 'Relevance' },
    { value: 'price', display: 'Price' },
    { value: 'title', display: 'Title' },
    { value: 'bestseller', display: 'Best Seller' },
    { value: 'customerRating', display: 'Customer Rating' },
    { value: 'new', display: 'New' }
  ];

  $scope.toggleHideAdvanced = function() {
    $scope.hideAdvanced = !$scope.hideAdvanced;
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

    var params = {
      query: $scope.query,
      sort: $scope.sortBy,
      start: $scope.startAt,
      numItems: $scope.numItems
    };

    // Brand params are slightly trickier with v1 API so do it here.
    if ($scope.brandName) {
      params.facet = 'on';
      params['facet.filter'] = 'brand:' + _.capitalize($scope.brandName);
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

      // Store the brand information in the original data array.
      WalmartRestangular.one('items').get({ids: productIds.join(',')})
      .then(function(products) {
        for (var i=0; i<results.length; i++) {
          if (results[i].itemId === products.items[i].itemId) {
            results[i].brandName = products.items[i].brandName;
            results[i].salePrice = products.items[i].salePrice;
            results[i].msrp = products.items[i].msrp;
          }
        }

        var itemsAdded = ProductService.addItems(data.items);
        var alertMessage = 'Added ' + itemsAdded + ' new items.';
        AlertService.success(alertMessage, 'fa-cart-plus');
        $scope.isLoading = false;
      });
    });
  };

  $scope.removeProduct = function(product) {
    ProductService.removeItem(product.itemId);
  };

  $scope.removeAllProducts = function() {
    var confirm = $window.confirm('Remove all items?');
    if (confirm) {
      ProductService.removeAllItems();
      AlertService.success('All products were removed.', 'fa-trash');
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


/********************************************************************
* FILTERS
*********************************************************************/
app.filter('isEmpty', function() {
  return function(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    } return true;
  };
});
