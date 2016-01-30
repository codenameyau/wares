'use strict';

var app = angular.module('walmartApp', ['ui.router']);

// Use relative paths b/c of github pages.
app.constant('PARTIALS_URL', '../assets/partials/');


/********************************************************************
* ROUTE CONFIGURATION
*********************************************************************/
app.config(function($stateProvider, $urlRouterProvider, PARTIALS_URL) {

  $stateProvider.state('home', {
    url: '/',
    controller: 'HomeController as home',
    templateUrl: PARTIALS_URL + 'home.html'
  });

  $urlRouterProvider.otherwise('/');

});


/********************************************************************
* CONTROLLERS
*********************************************************************/
app.controller('HomeController', function () {
  this.name = 'Hello World';
});
