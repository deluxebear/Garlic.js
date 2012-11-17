/*
  Garlic.js allows you to automatically persist your forms' text field values locally,
  until the form is submitted. This way, your users don't lose any precious data if they
  accidentally close their tab or browser.

  author: Guillaume Potier - @guillaumepotier
*/

!function ($) {

  "use strict";
  /*global localStorage */
  /*global document */

  /* STORAGE PUBLIC CLASS DEFINITION
   * =============================== */
  var Storage = function ( options ) {
    this.defined = 'undefined' !== typeof localStorage;
  }

  Storage.prototype = {

    constructor: Storage

    , get: function ( key, placeholder ) {
      return localStorage.getItem( key ) ? localStorage.getItem( key ) : 'undefined' !== typeof placeholder ? placeholder : null;
    }

    , has: function ( key ) {
      return localStorage.getItem( key ) ? true : false;
    }

    , set: function ( key, value, fn ) {
      if ( 'string' === typeof value && '' !== value ) {
        localStorage.setItem( key , value );
      }

      return 'function' === typeof fn ? fn() : true;
    }

    , destroy: function ( key, fn ) {
      localStorage.removeItem( key );
      return 'function' === typeof fn ? fn() : true;
    }

    , clean: function ( fn ) {
      for ( var i = localStorage.length - 1; i >= 0; i-- ) {
        if ( -1 !== localStorage.key(i).indexOf( 'garlic:' ) ) {
          localStorage.removeItem( localStorage.key(i) );
        }
      }

      return 'function' === typeof fn ? fn() : true;
    }

    , clear: function ( fn ) {
      localStorage.clear();
      return 'function' === typeof fn ? fn() : true;
    }
  }

 /* GARLIC PUBLIC CLASS DEFINITION
  * =============================== */

  var Garlic = function ( element, storage, options ) {
    this.init( 'garlic', element, storage, options );
  }

  Garlic.prototype = {

    constructor: Garlic

    , init: function ( type, element, storage, options ) {
      this.type = type;
      this.$element = $( element );
      this.options = this.getOptions( options );
      this.storage = storage;
      this.path = this.getPath();

      this.retrieve();

      this.$element.on( this.options.events.join( '.' + this.type + ' ') , false, $.proxy( this.persist, this ) );

      if ( this.options.destroy ) {
        this.$element.closest( 'form' ).on( 'submit reset' , false, $.proxy( this.destroy, this ) );
      }

      this.$element.addClass('garlic-auto-save');
    }

    , getOptions: function ( options ) {
      options = $.extend( {}, $.fn[this.type].defaults, options, this.$element.data() );

      return options;
    }

    , persist: function () {
      // for checkboxes, we need to implement a toggle behavior
      if ( this.$element.is( 'input[type=checkbox]' ) && this.storage.has( this.path )) {
        this.destroy();
        return;
      }

      this.storage.set( this.path , this.$element.val() );
    }

    , retrieve: function () {
      if ( this.storage.has( this.path ) ) {
        if ( this.$element.is( 'input[type=radio], input[type=checkbox]' ) ) {
          if ( this.storage.get( this.path ) === this.$element.val() ) {
            this.$element.attr( 'checked', 'checked' );
          }

          return;
        }

        this.$element.val( this.storage.get( this.path ) );
      }
    }

    // only delete localStorage
    , destroy: function () {
      if ( this.$element.is( 'input[type=radio], input[type=checkbox]' ) ) {
        this.$element.attr( 'checked', false );
      }

      this.storage.destroy( this.path );
    }

    // remove content and delete localStorage
    , remove: function () {
      this.remove();
      this.$element.val( '' );
    }

    /* retuns an unique identifier for form elements, depending on their behaviors:
       * radio buttons: domain > pathname > form.<attr.name>[:eq(x)] > input.<attr.name>
          no eq(); must be all stored under the same field name inside the same form

       * checkbokes: domain > pathname > form.<attr.name>[:eq(x)] > [fieldset, div, span..] > input.<attr.name>[:eq(y)]
          cuz' they have the same name, must detect their exact position in the form. detect the exact hierarchy in DOM elements

       * other inputs: domain > pathname > form.<attr.name>[:eq(x)] > input.<attr.name>[:eq(y)]
          we just need the element name / eq() inside a given form
    */
    , getPath: function () {

      // Requires one element.
      if ( this.$element.length != 1 ) {
        return false;
      }

      var path = ''
        , fullPath = this.$element.is( 'input[type=checkbox]')
        , node = this.$element;

      while ( node.length ) {
        var realNode = node[0]
          , name = realNode.localName;

        if ( !name ) {
          break;
        }

        name = name.toLowerCase();

        var parent = node.parent()
          , siblings = parent.children( name );

        // don't need to pollute path with select, fieldsets, divs and other noisy elements,
        // exept for checkboxes that need exact path, cuz have same name and sometimes same eq()!
        if ( !$( realNode ).is( 'form, input, select, textarea' ) && !fullPath ) {
          node = parent;
          continue;
        }

        // set input type as name + name attr if exists
        name += 'undefined' !== typeof $( realNode ).attr( 'name' ) ? '.' + $( realNode ).attr( 'name' ) : '';

        // if has sibilings, get eq(), exept for radio buttons
        if ( siblings.length > 1 && !$( realNode ).is( 'input[type=radio]' ) ) {
          name += ':eq(' + siblings.index( realNode ) + ')';
        }

        path = name + ( path ? '>' + path : '' );

        // break once we came up to form:eq(x), no need to go further
        if ( 'form' == realNode.localName ) {
          break;
        }

        node = parent;
      }

      return 'garlic:' + document.domain + window.location.pathname + '>' + path;
    }

    , getStorage: function () {
      return this.storage;
    }
  }

  /* GARLIC PLUGIN DEFINITION
  * ========================= */

  $.fn.garlic = function ( option ) {
    var options = $.extend( {}, $.fn.garlic.defaults, option, this.data() )
      , storage = new Storage()
      , returnValue = false;

    // this plugin heavily rely on local Storage. If there is no localStorage or data-storage=false, no need to go further
    if ( !storage.defined ) {
      return false;
    }

    if ( options.debug && 'undefined' === typeof garlicStorage ) {
      window.garlicStorage = storage;
    }

    function bind (self) {
      var $this = $( self )
        , data = $this.data( 'garlic' )
        , fieldOptions = $.extend( options, $this.data() );

      // don't bind an elem with data-storage=false
      if ( 'undefined' !== typeof fieldOptions.storage && !fieldOptions.storage ) {
        return;
      }

      // if data never binded, bind it right now!
      if ( !data ) {
        $this.data( 'garlic', ( data = new Garlic( self, storage, fieldOptions ) ) );
      }

      // here is our garlic public function accessor, currently does not support args
      if ( 'string' === typeof option && 'function' === typeof data[option] ) {
        return data[option]();
      }
    }

    // loop through every elemt we want to garlic
    this.each(function () {
      var self = this;

      // if a form elem is given, bind all its input children
      if ( $( this ).is( 'form' ) ) {
        $( this ).find( options.inputs ).each( function () {
          returnValue = bind( $( this ) );
        });

      // if it is a Garlic supported single element, bind it too
      // add here a return instance, cuz' we could call public methods on single elems with data[option]() above
      } else if ( $( this ).is( options.inputs ) ) {
        returnValue = bind( $( this ) );
      }
    });

    return returnValue;
  }

  /* GARLIC CONFIGS & OPTIONS
  * ========================= */

  $.fn.garlic.Constructor = Garlic;

  $.fn.garlic.defaults = {
      debug: true                                                                                 // debug mode. Add garlicStorage to window. TODO: make a proper getter
    , inputs: 'input[type=text], input[type=radio], input[type=checkbox], textarea, select'       // Default supported inputs.
    , events: [ 'DOMAttrModified', 'textInput', 'input', 'change', 'keypress', 'paste', 'focus' ] // events list that trigger a localStorage
    , destroy: true                                                                               // remove or not localstorage on submit & clear 
  }

  /* GARLIC DATA-API
  * =============== */
  $( window ).on( 'load', function () {
    $( '[data-persist="garlic"]' ).each( function () {
      $(this).garlic();
    })
  })

// This plugin works with jQuery or Zepto (with data extension builded for Zepto. See changelog 0.0.6)
}(window.jQuery || Zepto);
