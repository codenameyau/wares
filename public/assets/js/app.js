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
      {callback: 'JSON_CALLBACK'});
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

  $scope.hideAdvanced = false;
  $scope.results = null;
  $scope.sortCriteria = [
    {value: 'relevance', display: 'Relevance'},
    {value: 'price', display: 'Price'},
    {value: 'title', display: 'Title'},
    {value: 'bestseller', display: 'Best Seller'},
    {value: 'customerRating', display: 'Customer Rating'},
    {value: 'new', display: 'New'}
  ];

  $scope.toggleHideAdvanced = function() {
    $scope.hideAdvanced = !$scope.hideAdvanced;
  };

  $scope.submitForm = function(form) {
    if (!form.$valid) { return; }

    var promise = WalmartService.one('search').get({
      query: $scope.query,
      sort: $scope.sortBy,
      start: $scope.start,
      numItems: $scope.numItems
    });

    promise.then(function(data) {
      $scope.results = data.items;
    });

  };

});
