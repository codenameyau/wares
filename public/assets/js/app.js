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
* APP RUN
*********************************************************************/
app.run(function($rootScope) {
  $rootScope.alerts = {};
});


/********************************************************************
* SERVICES
*********************************************************************/
app.service('WalmartService', function(Restangular, WALMART_API, WALMART_KEY) {

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

  this.alertTime = 3000;

  this.clearAlertTimeout = function(name, time) {
    $timeout(function() {
      $rootScope.alerts[name] = null;
    }, time || this.alertTime);
  };

  this.success = function(message) {
    $rootScope.alerts.success = message;
    this.clearAlertTimeout('success');
  };

  this.warn = function(message) {
    $rootScope.alerts.warning = message;
    this.clearAlertTimeout('warning');
  };

  this.error = function(message) {
    $rootScope.alerts.error = message;
    this.clearAlertTimeout('error');
  };
});

app.service('StorageService', function(localStorageService) {

  this.getAllItems = function() {
    return _.map(localStorageService.keys(), function(key) {
      return localStorageService.get(key);
    });
  };

  this.storeItem = function(item, key) {
    var storedItem = localStorageService.get(item[key]);
    if (storedItem) {
      // User should be notified that item already exists.
      console.log(storedItem);
    } else {
      return localStorageService.set(item[key], item);
    }
  };

  this.storeList = function(list, key) {
    for (var i=0; i<list.length; i++) {
      this.storeItem(list[i], key);
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
  $scope, $window, WalmartService, AlertService, StorageService) {

  // Controls the ordering of products.
  $scope.orderCriteria = 'name';
  $scope.orderReverse = false;
  $scope.isLoading = false;
  $scope.hideAdvanced = false;
  $scope.products = StorageService.getAllItems();
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
    WalmartService.one('search').get(params).then(function(data) {

      // Show alert if no results are found.
      if (!data.totalResults) {
        $scope.isLoading = false;
        AlertService.warn(data.message);
        return;
      }

      // Then retrieve the brand name from the product API.
      var results = data.items;
      var productIds = _.map(results, function(product) {
        return product.itemId;
      });

      // Store the brand information in the original data array.
      WalmartService.one('items').get({ids: productIds.join(',')})
      .then(function(products) {
        for (var i=0; i<results.length; i++) {
          if (results[i].itemId === products.items[i].itemId) {
            results[i].brandName = products.items[i].brandName;
            results[i].salePrice = products.items[i].salePrice;
            results[i].msrp = products.items[i].msrp;
          }
        }

        StorageService.storeList(data.items, 'itemId');
        $scope.products = StorageService.getAllItems();
        $scope.isLoading = false;
      });
    });
  };

  $scope.removeProduct = function(product) {
    StorageService.removeItem(product.itemId);
    $scope.products = StorageService.getAllItems();
  };

  $scope.removeAllProducts = function() {
    var confirm = $window.confirm('Remove all items?');
    if (confirm) {
      StorageService.clearStorage();
      $scope.products = [];
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
