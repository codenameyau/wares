'use strict';

var app = angular.module('walmart-app', ['ui.router', 'restangular']);

// Use relative paths for github pages.
app.constant('PARTIALS_URL', '../assets/partials/');

// Since we're exposing our API key, let's break it up so bots can't read it.
app.constant('WALMART_KEY', '8ks2tc' + 'fzcz38' + 'a5xtc8' + 'u67ujk');

// Walmart's API base url.
app.constant('WALMART_API', 'http://api.walmartlabs.com/v1/');


/********************************************************************
* ROUTE CONFIGURATION
*********************************************************************/
app.config(function($stateProvider, $urlRouterProvider, PARTIALS_URL) {

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
app.service('WalmartService', function(
  $http, Restangular, WALMART_API, WALMART_KEY) {

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


/********************************************************************
* CONTROLLERS
*********************************************************************/
app.controller('HomeController', function ($scope, WalmartService) {

  $scope.isLoading = false;
  $scope.hideAdvanced = false;
  $scope.products = null;
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

  $scope.submitForm = function(form) {
    if (!form.$valid) { return; }
    $scope.isLoading = true;

    var params = {
      query: $scope.query,
      sort: $scope.sortBy,
      start: $scope.startAt,
      numItems: $scope.numItems,
      facet: 'on'
    };

    var promise = WalmartService.one('search').get(params);

    promise.then(function(data) {
      $scope.isLoading = false;
      $scope.products = data.items;
    });
  };

});


/********************************************************************
* DIRECTIVES
*********************************************************************/
app.directive('appLoader', function() {
  return {
    restrict: 'E',
    replace: true,

    template: function() {
      return [
        '<div ng-if="isLoading" class="loader">',
        '<i class="fa fa-5x fa-crosshairs fa-spin"></i>',
        '</div>'
      ].join(' ');
    }
  };
});

app.directive('appRatingStars', function() {
  return {
    restrict: 'E',
    transclude: true,
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

    template: function() {
      return [
        '<span ng-repeat="n in stars track by $index">',
        '<i ng-if="n === \'full\'" class="fa fa-star"></i>',
        '<i ng-if="n === \'half\'" class="fa fa-star-half"></i>',
        '<i ng-if="n === \'empty\'" class="fa fa-star fa-star-empty"></i>',
        '</span>'
      ].join(' ');
    }
  };
});
