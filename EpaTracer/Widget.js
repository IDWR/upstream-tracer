/**
 * @fileOverview EpaTracer (upstream-tracer) widget.
 * Trace NHDPlus flow-lines, upstream from a location, buffer and select features.
 * @author <a href="mailto:ben.britton@idwr.idaho.gov">Ben Britton</a>
 * @version 1.0.0
 */
///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  "dojo/_base/declare",
  "dijit/_WidgetsInTemplateMixin",
  "jimu/BaseWidget",
  "dojo/on",
  "dojo/dom-construct",
  "dojo/dom-class",
  "dojo/query",
  "dojo/keys",
  "dojo/_base/lang",
  "dojo/_base/array",
  "./utils",
  "./search",
  "./item-list",
  "./filter-list",
  "jimu/portalUtils",
  "esri/layers/GraphicsLayer",
  "esri/graphic",
  "esri/tasks/GeometryService",
  "esri/tasks/BufferParameters",
  "dijit/form/HorizontalSlider",
  "dojo/dom-attr",
  "dojo/string",
  "dojo/dom-geometry",
  "dojo/dom-style",
  "esri/symbols/jsonUtils",
  "esri/tasks/locator",
  "esri/geometry/webMercatorUtils",
  "esri/InfoTemplate",
  "jimu/dijit/Message",
  "jimu/dijit/LoadingIndicator",
  "dijit/registry",
  "dojo/Deferred",
  "dojo/promise/all",
  "esri/tasks/query",
  "esri/tasks/QueryTask",
  "esri/request",
  "esri/geometry/scaleUtils",
  "esri/geometry/Extent",
  "esri/geometry/Polyline",
  'jimu/dijit/EditorXssFilter',
  "esri/SpatialReference",
  "esri/dijit/LocateButton",
  "jimu/utils",
  "jimu/CSVUtils",
  'dijit/focus',
  'dijit/form/NumberTextBox'
], function (
  declare,
  _WidgetsInTemplateMixin,
  BaseWidget,
  on,
  domConstruct,
  domClass,
  query,
  keys,
  lang,
  array,
  appUtils,
  SearchInstance,
  ItemList,
  FilterList,
  portalUtils,
  GraphicsLayer,
  Graphic,
  GeometryService,
  BufferParameters,
  HorizontalSlider,
  domAttr,
  string,
  domGeom,
  domStyle,
  symbolJsonUtils,
  Locator,
  webMercatorUtils,
  InfoTemplate,
  Message,
  LoadingIndicator,
  registry,
  Deferred,
  all,
  Query,
  QueryTask,
  esriRequest,
  scaleUtils,
  Extent,
  Polyline,
  EditorXssFilter,
  SpatialReference,
  LocateButton,
  jimuUtils,
  CSVUtils,
  focusUtil,
  NumberTextBox
) {
  return declare([BaseWidget, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-epatracer', // Set the widget base class name.
    _highlightGraphicsLayer: null, // Layer to add highlight symbols
    _flowlinesGraphicsLayer: null, // Layer to flow-lines symbols
    _loading: null, // Loading indicator object
    _windowResizeTimer: null, // Timer to control widget component resize on window resize
    _sliderChangeTimer: null, // Timer to control buffer creation on slider change
    _mapTooltip: null, // MapTooltip Container
    _searchContainerNodeElement: null, // Search container
    _locatorInstance: null, // Locator instance to reverse geocode the address
    _searchedLocation: null, // Contain searched location
    _slider: null, // Horizontal slider instance
    _bufferParams: null, // To store Buffer parameters
    _upstreamDistanceParams: null, // To store upstream-trace parameters
    _mapClickHandler: null, // Map click handler
    _mapMoveHandler: null, // Map move handler
    _itemListObject: null, // Item-list widget instance
    _isValidConfig: null, //Flag to check whether config has valid data for the widget
    appUtils: null,
    _hasMulitpleSourcesInSearch: true, //Set this flag if their are multiple sources in search
    _searchInstance: null, //To store search instance
    _attributeSearchLayers: [],//To store ids of layer on which attribute search can be performed
    _doAttributeSearchOn: [], //Layers on which attribute search needs to be performed
    selectedThemeColor: "#000", //to store selected theme's color
    _geocoderSpatialRef: null, //to store spatialRef of geocder
    epaServiceUrl: "",
    epaResultsQueueId: "",
    _lastFocusNodes: {
      "mainScreen": null,
      "layerList": null,
      "featureList": null,
      "featureInfo": null,
      "filterList": null
    },

    postCreate: function () {
      //for backwardcmpatibility if showImageGallery is not found in config add it
      if (!this.config.hasOwnProperty('showImageGallery')) {
        this.config.showImageGallery = true;
      }
      //for backwardcmpatibility if showFeaturesCount is not found in config add it
      if (!this.config.hasOwnProperty('showFeaturesCount')) {
        this.config.showFeaturesCount = true;
      }
      //for backwardcmpatibility if bufferInputOption is not found in config add it and set to slider only
      if (!this.config.hasOwnProperty('bufferInputOption')) {
        this.config.bufferInputOption = "slider";
      }
      this.editorXssFilter = EditorXssFilter.getInstance();
      this._bufferParams = null;  //To store Buffer parameters
      this._upstreamDistanceParams = null; // To store upstream-trace parameters
      this.selectedThemeColor = "#000";
      this.openAtStartAysn = true; //’this’ is widget object 
      this._getSelectedThemeColor();
      //For supporting backward compatibility
      //If enableDirection key is not available in config
      //then enable direction based on webmap routing property
      if (!this.config.hasOwnProperty("enableDirection")) {
        if (this.map.webMapResponse.itemInfo.itemData && this.map.webMapResponse
          .itemInfo.itemData.applicationProperties && this.map.webMapResponse
            .itemInfo.itemData.applicationProperties.viewing && this.map.webMapResponse
              .itemInfo.itemData.applicationProperties.viewing.routing &&
          this.map.webMapResponse.itemInfo.itemData.applicationProperties
            .viewing.routing.enabled) {
          this.config.enableDirection = true;
        } else {
          this.config.enableDirection = false;
        }
      }
      //upadte route service url with configured app proxy
      if (this.config.routeService) {
        this.config.routeService =
          this._replaceRouteTaskUrlWithAppProxy(this.config.routeService);
      }
      this._attributeSearchLayers = [];
      this._doAttributeSearchOn = [];
      //if no filter defined then hide apply filter node
      if (!this.config.filterSettings || !this.config.filterSettings.filters ||
        this.config.filterSettings.filters.length <= 0) {
        domClass.add(this.applyFilterNode, "esriCTHidden");
      }
      
      this.epaServiceUrl = 'https://ofmpub.epa.gov/waters10/';
    },

    startup: function () {
      domClass.add(this.domNode.parentElement, "esriCTEpaTracerContentPanel’");
      //check whether portal url is available
      if (this.appConfig.portalUrl && lang.trim(this.appConfig.portalUrl) !== "") {
        //get portal info to fetch geometry service Url
        portalUtils.getPortalSelfInfo(this.appConfig.portalUrl).then(lang.hitch(
          this,
          function (portalInfo) {
            // get helper-services from portal object
            this.config.helperServices = portalInfo && portalInfo.helperServices;
            if (this.config.helperServices && this.config.helperServices.geometry) {
              // validate if layers are configured then only load the widget
              this._isValidConfig = this._validateConfig();
              if (this._isValidConfig) {
                //initialize utils widget
                this.appUtils = new appUtils({ map: this.map });
                //update config for current webmap properties
                this._updateConfig();
                //Show main node
                domClass.remove(this.widgetMainNode, "esriCTHidden");
                //Hide Error node
                domClass.add(this.widgetErrorNode, "esriCTHidden");
                //load the widget
                this._initWidgetComponents();
                //connect map click handler if not connected
                if (this.config.showLocationTool) {
                  domClass.remove(this.selectLocation, "esriCTHidden");
                } else {
                  if (!this._mapClickHandler) {
                    this._connectMapEventHandler();
                  }
                }
                this._onWindowResize();
              } else {
                //Hide main node
                domClass.add(this.widgetMainNode, "esriCTHidden");
                //Show Error node
                domClass.remove(this.widgetErrorNode, "esriCTHidden");
              }
            } else {
              //display error message if geometry service is not found
              this._displayWidgetError(this.nls.geometryServicesNotFound);
            }
          }), lang.hitch(this, function () {
            //display error message if any error occured while fetching portal info for geometry service
            this._displayWidgetError(this.nls.geometryServicesNotFound);
          }));
      } else {
        //display error message if portal url is not available
        this._displayWidgetError(this.nls.geometryServicesNotFound);
      }
    },

    /**
    * Use proxies to replace the routeTaskUrl if configured
    * -- memberOf widgets/EpaTracer/Widget
    */
    _replaceRouteTaskUrlWithAppProxy: function (routeTaskUrl) {
      var ret = routeTaskUrl;
      if (!window.isBuilder && !this.appConfig.mode &&
        this.appConfig.appProxies && this.appConfig.appProxies.length > 0) {
        array.some(this.appConfig.appProxies, function (proxyItem) {
          if (routeTaskUrl === proxyItem.sourceUrl) {
            ret = proxyItem.proxyUrl;
            return true;
          }
        });
      }
      return ret;
    },

    /**
    * Display error message in error node
    * -- memberOf widgets/EpaTracer/Widget
    */
    _displayWidgetError: function (msg) {
      if (this.widgetErrorNode) {
        domAttr.set(this.widgetErrorNode, "innerHTML", msg);
      }
      this._showMessage(msg);
    },

    /**
    * Resize the widget components and connect map click on widget open
    * -- memberOf widgets/EpaTracer/Widget
    */
    onOpen: function () {
      if (this._isValidConfig) {
        this._onWindowResize();
        if (!this.config.showLocationTool) {
          this._connectMapEventHandler();
        }
        if (this._slider) {
          this._slider.set("value", this.config.defaultBufferDistance);
        }
        if (jimuUtils.isAutoFocusFirstNodeWidget(this)) {
         jimuUtils.focusFirstFocusNode(this.domNode);
        }
      }
    },

    /**
    * Resize the widget components on widget resize
    * -- memberOf widgets/EpaTracer/Widget
    */
    resize: function () {
      this._onWindowResize();
    },

    /**
    * This function clears results when widget is destroyed
    * -- memberOf widgets/EpaTracer/Widget
    */
    destroy: function () {
      //destroy widget data
      this._destroyWidgetData();
      this.inherited(arguments);
    },

    /**
    * disconnect map click on widget close
    * -- memberOf widgets/EpaTracer/Widget.js
    */
    onClose: function () {
      if (this._isValidConfig) {
        this._disconnectMapEventHandler();
        //Clear the previous text in search textbox
        if (this._searchInstance) {
          this._searchInstance.clearSearchText();
        }
        if (this._searchedLocation && this._itemListObject) {
          this._itemListObject.resetAllFilters();
          this._clearResults();
        }
        //set layers visibility according to widget load
        if (this._itemListObject) {
          this._itemListObject.showAllLayers(true);
        }
      }
    },

    /**
    * disconnect map click on widget close
    * -- memberOf widgets/EpaTracer/Widget.js
    */
    onDeActive: function () {
      if (this._isValidConfig && this.config.showLocationTool) {
        this._disconnectMapEventHandler();
      }
    },

    /**
    * This function destroys itemList widget and clears the search result
    * -- memberOf widgets/EpaTracer/Widget
    */
    _destroyWidgetData: function () {
      if (this._itemListObject) {
        this._itemListObject.removeGraphicsLayer();
        this._itemListObject.showAllLayers(true);
        this._itemListObject.resetAllFilters();
        this._itemListObject.destroy();
        this._itemListObject = null;
      }
      this._clearResults();
    },

    /**
    * This function validates the configured data
    * -- memberOf widgets/EpaTracer/Widget
    */
    _validateConfig: function () {
      if (!(this.config.searchLayers && this.config.searchLayers.length)) {
        this._displayWidgetError(this.nls.invalidSearchLayerMsg);
        return false;
      }
      //check if newly added config parameters are available in config or not
      if (!this.config.symbols.polygonSymbol) {
        this.config.symbols.polygonSymbol = {
          "color": [255, 189, 1, 0],
          "outline": {
            "color": [255, 189, 1, 255],
            "width": 2.25,
            "type": "esriSLS",
            "style": "esriSLSSolid"
          },
          "type": "esriSFS",
          "style": "esriSFSSolid"
        };
      }
      if (!this.config.symbols.polylineSymbol) {
        this.config.symbols.polylineSymbol = {
          "color": [21, 99, 184, 255],
          "width": 3.75,
          "type": "esriSLS",
          "style": "esriSLSSolid"
        };
      }
      return true;
    },

    /**
    * This function updates the layer-details for the configured layers from selected webmap
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _updateConfig: function () {
      var i;
      for (i = 0; i < this.config.searchLayers.length; i++) {
        lang.mixin(this.config.searchLayers[i], this.appUtils.getLayerDetailsFromMap(
          this.config.searchLayers[i].baseURL, this.config.searchLayers[i]
            .layerId, this.config.searchLayers[i].id));
      }
    },

    /**
    * Create and show alert message.
    * @param {string} msg
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _showMessage: function (msg) {
      var alertMessage = new Message({
        message: msg
      });
      alertMessage.message = msg;
    },

    /**
    * Initialize all widget components
    * -- memberOf widgets/EpaTracer/Widget
    */
    _initWidgetComponents: function () {
      //text to be displayed above search box
      if (this.config.editorDescription) {
        this.searchHeaderTextNode.innerHTML = this.editorXssFilter.sanitize(this.config.editorDescription);
      }
      //create graphic layer to add buffer
      this._bufferGraphicLayer = new GraphicsLayer();
      this.map.addLayer(this._bufferGraphicLayer);
      //create graphic layer to add search location graphic
      this._highlightGraphicsLayer = new GraphicsLayer();
      this.map.addLayer(this._highlightGraphicsLayer);
      this._flowlinesGraphicsLayer = new GraphicsLayer();
      this.map.addLayer(this._flowlinesGraphicsLayer);
      //Create search widget
      this._createSearchInstance();
      //create current location widget
      this._createCurrentLocationInstance();
      //initialize buffer distance slider
      this._createSlider();
      //initialize loading indicator
      this._createUpstreamDistance();
      // initialize upstream-distance search parameters
      this._initLoading();
      //initialize layer list widget
      this._initLayerList();
      //based on selected buffer option show slider/textbox/both
      this._displayBufferInputOptions();
      // show bufferslider widget if configured layers
      // are not polygon type and intersect polygon flag is disabled
      this._setBufferSliderVisiblity();
      //connect set location tool button handler if tool is configured
      if (this.config.showLocationTool) {
        this._connectSelectLocationHandler();
      }
      //create tool-tip to be shown on map move
      this._mapTooltip = domConstruct.create("div", {
        "class": "esriCTMapTooltip",
        "innerHTML": this.nls.selectLocationToolTip
      }, this.map.container);
      domStyle.set(this._mapTooltip, "position", "fixed");
      domStyle.set(this._mapTooltip, "display", "none");
      //reset the widget's components on window resize and on widget open
      this.own(on(window, 'resize', lang.hitch(this, this._onWindowResize)));
      //Create filter list
      this._createFilterList();

      this.own(on(this.downloadItemsNode, "click", lang.hitch(this, function (evt) {
          console.debug("this._itemListObject is ", this._itemListObject);
          console.debug("this._itemListObject._searchedFeatures is ", this._itemListObject._searchedFeatures);
          this.createCsv(this._itemListObject._searchedFeatures, this._itemListObject._operationalLayers);
        })));
    },

    /**
     * Hide filter list before init workflow as the focus will shift outside the widget
     * when the locations are updated and the filter list open
     */
    _hideFilterListBeforeInitWorkflow: function () {
      //if apply filter node is visible and filter is open
      if (!domClass.contains(this.applyFilterNode, "esriCTHidden")) {
        if (!domClass.contains(this.filterListOuterDiv, "esriCTHidden")) {
          domClass.toggle(this.applyFilterArrowNode, "esriCTApplyFilterArrowUp");
          domClass.remove(this.layerListOuterDiv, "esriCTHidden");
          domClass.add(this.filterListOuterDiv, "esriCTHidden");
        }
      }
    },

    /**
     * Show/Hide filter list based on the arrow
     */
    _showHideFilterList: function(){
      domClass.toggle(this.applyFilterArrowNode, "esriCTApplyFilterArrowUp");
      if(domClass.contains(this.applyFilterArrowNode, "esriCTApplyFilterArrowUp")){
        domClass.add(this.layerListOuterDiv, "esriCTHidden");
        domClass.remove(this.filterListOuterDiv, "esriCTHidden");
        //Update last node once the filter panel is open
        jimuUtils.initLastFocusNode(this.domNode,
          this._filterList.getLastNode());
        //set filter list shown
        this._filterList.filterListShown();
      } else{
        domClass.remove(this.layerListOuterDiv, "esriCTHidden");
        domClass.add(this.filterListOuterDiv, "esriCTHidden");
        //When search location is present then the layerlist/feature list may be opened
        //then the lastnode shoud come from itemList
        //else set the last node on main screen
        if (this._searchedLocation) {
          this._itemListObject.emit("setLastNode", this._itemListObject._currentPanelName);
        } else {
          //Get and set the main screen last focus node
          this._getMainScreenLastNode();
        }
        //if location exist & filters are updated then init workflow around the searched location
        if (this._searchedLocation && this._filterList.filtersUpdated &&
          this._prevFeature) {
          this._initWorkflow(this._prevFeature, this._prevAttributeSearchResult);
        }
      }
    },

    /**
     * Creates filter list based on the configured filter settings
     */
    _createFilterList: function () {
      //create filter list only if filter settings are configured
      if (this.config.filterSettings && this.config.filterSettings.filters &&
        this.config.filterSettings.filters.length > 0) {
        this._filterList = new FilterList({
          map: this.map,
          config: this.config.filterSettings,
          nls: this.nls,
          folderUrl: this.folderUrl,
          clearAllButton: this.clearAllFilterButton
        }, domConstruct.create("div", {}, this.filterListNode));
        //Set last focus node based on the panel displayed
        this.own(on(this._filterList, "setLastFilterNode",
          lang.hitch(this, function (node) {
            jimuUtils.initLastFocusNode(this.domNode, node);
          })));
        //if all filters are cleared and _searchedLocation is present
        //we need to init workflow again as the cleared filters may change the result
        this.own(on(this._filterList, "clearAllFilters",
          lang.hitch(this, function (node) {
            //if location exist & filters are updated then init workflow around the searched location
            if (this._searchedLocation && this._filterList.filtersUpdated &&
              this._prevFeature) {
              this._initWorkflow(this._prevFeature, this._prevAttributeSearchResult);
            }
          })));
        this._filterList.startup();
        //handle click/keydown events for apply filter arrow node
        this.own(on(this.applyFilterArrowNodeParent, "click", lang.hitch(this, function (evt) {
          this._showHideFilterList();
        })));
        this.own(on(this.applyFilterArrowNodeParent, "keydown", lang.hitch(this, function (evt) {
          if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
            this._showHideFilterList();
          }
        })));
        //if expandFiltersOnLoad is true show filter list
        if (this.config.filterSettings.expandFiltersOnLoad) {
          this._showHideFilterList();
        }
      }
    },

    /**
     * Creates set of layers configured for both proximity and searchSources
     * which can be used to do attribute search.
     */
    _setLayersForAttributeSearch: function (searchSources) {
      var searchLayers = [];
      this._attributeSearchLayers = [];
      if (searchSources && searchSources.length > 0) {
        //get all layers configured for proximity search
        array.forEach(this.config.searchLayers, lang.hitch(this, function (layer) {
          searchLayers.push(layer.id);
        }));
        //loop through search sources and select layers which are configured for both
        //searchSources and proximity search
        array.forEach(searchSources, lang.hitch(this, function (source) {
          if (source._featureLayerId &&
            searchLayers.indexOf(source._featureLayerId) > -1) {
            this._attributeSearchLayers.push(source);
          }
        }));
      }
    },

    /**
     * Performs attribute search on the selected sources and return the deferred.
     * On complete it will return all the ids satisfying search criteria for all sources.
     * -- memberOf widgets/EpaTracer/Widget
     */
    _performAttributeSearch: function (sources) {
      var deferred, deferredList = [], featureLayerIdsList = [];
      deferred = new Deferred();
      array.forEach(sources, lang.hitch(this, function (source) {
        var searchText, where;
        searchText = this._searchInstance.getSearchText();
        //get where clause using internal method of search dijit
        where = this._searchInstance.search._whereClause(searchText, source.featureLayer,
          source.searchFields, source.exactMatch);
        //If the definition expression exist on layer add it to the where clause
        if (source.featureLayer.getDefinitionExpression()) {
          where = source.featureLayer.getDefinitionExpression() + " and " + where;
        }
        //get id's of the features satisfying search criteria
        deferredList.push(this._queryForIds(source.featureLayer, where));
        featureLayerIdsList.push(source._featureLayerId)
      }));
      //on getting all the ids resolve the deferred
      all(deferredList).then(lang.hitch(this, function (idsList) {
        var result;
        for (var i = 0; i < idsList.length; i++) {
          var existingList = [];
          if (idsList[i].length > 0) {
            if (!result) {
              result = {};
            }
            if (result.hasOwnProperty(featureLayerIdsList[i])) {
              existingList = result[featureLayerIdsList[i]];
            }
            existingList = this._addOIDsInList(existingList, idsList[i]);
            result[featureLayerIdsList[i]] = existingList;
          }
        }
        deferred.resolve(result);
      }));
      return deferred.promise;
    },

    _addOIDsInList: function (existingList, newList) {
      for (var i = 0; i < newList.length; i++) {
        if (existingList.indexOf(newList[i]) < 0) {
          existingList.push(newList[i]);
        }
      }
      return existingList
    },


    /**
     * Gets all the ids for the selected layer satisfying the whereClause
     * -- memberOf widgets/EpaTracer/Widget
     */
    _queryForIds: function (layer, where) {
      var queryTask, queryParameters, deferred;
      deferred = new Deferred();
      queryTask = new QueryTask(layer.url);
      queryParameters = new Query();
      queryParameters.returnGeometry = false;
      queryParameters.where = where ? where : "1=1";
      queryTask.executeForIds(queryParameters).then(lang.hitch(this, function (ids) {
        if (ids && ids.length > 0) {
          //If more features are found than the maxRecordCount, honor maxRecordCount of the layer
          if (ids.length > layer.maxRecordCount) {
            ids = ids.slice(0, layer.maxRecordCount);
          }
          deferred.resolve(ids);
        } else {
          deferred.resolve([]);
        }
      }), lang.hitch(this, function () {
        deferred.resolve([]);
      }));
      return deferred.promise;
    },

    /**
    * This function initialize the search widget
    * -- memberOf widgets/EpaTracer/Widget
    */
    _createSearchInstance: function () {
      var searchOptions;
      // get webmap response
      this.config.response = this.map.webMapResponse;
      //set search options
      searchOptions = {
        addLayersFromMap: false,
        autoNavigate: false,
        autoComplete: true,
        minCharacters: 0,
        maxLocations: 5,
        searchDelay: 100,
        enableHighlight: false
      };
      // create an instance of search widget
      this._searchInstance = new SearchInstance({
        searchOptions: searchOptions,
        config: this.config,
        appConfig: this.appConfig,
        nls: this.nls,
        map: this.map
      }, domConstruct.create("div", {}, this.search));
      //handle search widget events
      this.own(this._searchInstance.on("init-attribute-search",
        lang.hitch(this, function () {
          var activeSource, filteredArr = [];
          this._doAttributeSearchOn = [];
          //if valid attribute search layers available then only check for active source
          if (this._attributeSearchLayers.length > 0) {
            activeSource = this._searchInstance.getActiveSource();
            /**
             * -If activeSource is valid layer and it is available in attributeSearch layer then
             * only do attribute search on activeSource
             * -If activeSource is geocoder don't perform attributeSearch
             * -If activeSource is 'All'(null) then perform search on all layers in _attributeSearchLayers
             */
            if (activeSource) {
              if (activeSource._featureLayerId) {
                filteredArr = array.filter(this._attributeSearchLayers,
                  lang.hitch(this, function (item) {
                    return item._featureLayerId === activeSource._featureLayerId;
                  }));
                if (filteredArr.length > 0) {
                  this._doAttributeSearchOn.push(activeSource);
                }
              }
            } else {
              this._doAttributeSearchOn = this._attributeSearchLayers;
            }
          }
        })));

      this.own(this._searchInstance.on("select-result", lang.hitch(this, function (evt) {
        evt.isFeatureFromMapClick = false;
        /**
         * 1.0-If init-attribute-search is invoked & have valid layers to do attribute search then,
         *     perform attribute search on all layers in '_doAttributeSearchOn' array
         * 2.1-Else if init-attribute-search is not invoked & selectedFeature is from attributeSearchLayers
         *     then show selectedFeature details directly
         * 2.2-Else perform the workflow on the selected result from search dijit
         */
        if (this._doAttributeSearchOn.length > 0) {
          this._performAttributeSearch(this._doAttributeSearchOn).then(
            lang.hitch(this, function (idsList) {
              var initWorkFlowOnSelectedResult = true;
              if (idsList) {
                //loop through all the ids of all layers matching search criteria & initWorkFlow
                for (var layerID in idsList) {
                  var ids = idsList[layerID];
                  //if any of the layers has results then don't init workFlow with selectedResult
                  //else if don't have results remove the layer from list
                  if (ids.length > 0) {
                    initWorkFlowOnSelectedResult = false;
                  } else {
                    delete idsList[layerID];
                  }
                }
              }
              //if none of the layers has results for selected search term
              //then initWorkFlow with the feature returned in the select-result event
              if (initWorkFlowOnSelectedResult) {
                this._initWorkflow(evt);
              } else {
                this._initWorkflow(null, idsList);
              }
            }));
        } else {
          var idsList, filteredArr, objectIdField, initWorkFlowOnSelectedResult = true;
          //if selected feature is from attributeSearch layers show selectedFeature details
          if (evt && evt.source && evt.source._featureLayerId && evt.source.featureLayer) {
            filteredArr = array.filter(this._attributeSearchLayers,
              lang.hitch(this, function (item) {
                return item._featureLayerId === evt.source._featureLayerId;
              }));
            if (filteredArr.length > 0 && evt.source.featureLayer.objectIdField &&
              evt.result.feature.attributes) {
              initWorkFlowOnSelectedResult = false;
              objectIdField = evt.source.featureLayer.objectIdField;
              idsList = {};
              idsList[evt.source._featureLayerId] = [evt.result.feature.attributes[objectIdField]];
            }
          }
          if (initWorkFlowOnSelectedResult) {
            this._initWorkflow(evt);
          } else {
            this._initWorkflow(null, idsList);
          }
        }
      })));
      this.own(this._searchInstance.on("clear-search", lang.hitch(this, function () {
        //clears the applied filters by widget and display the layers
        if (this._itemListObject) {
          this._itemListObject.showAllLayers(true);
          this._itemListObject.resetAllFilters();
        }
        //clears result
        this._clearResults();
        this._getMainScreenLastNode();
      })));
      this.own(this._searchInstance.on("search-results", lang.hitch(this, function () {
        this._clearResults(true);
      })));
      this.own(this._searchInstance.on("search-loaded", lang.hitch(this, function () {
        setTimeout(lang.hitch(this, function () {
          //Check if search info section contains focusable node
          var node = jimuUtils.getFocusNodesInDom(this.searchHeaderTextNode);
          if (node && node.length > 0) {
            jimuUtils.initFirstFocusNode(this.domNode, node[0]);
          } else {
            //Set the first focus node based on search sources
            if (this._searchInstance.search.sources.length === 1) {
              jimuUtils.initFirstFocusNode(this.domNode, this._searchInstance.search.inputNode);
            } else {
              jimuUtils.initFirstFocusNode(this.domNode, this._searchInstance.search.sourcesBtnNode);
            }
          }
          this._getMainScreenLastNode();
          //initialize reverse geocoder
          this._initReverseGeocoder();
          //get search container node to resize the search control
          this._searchContainerNodeElement = query(
            ".arcgisSearch .searchGroup .searchInput", this.domNode
          )[0];
          //set _hasMulitpleSourcesInSearch to false if multiple sources are not present
          if (this._searchInstance.search.sources.length < 2) {
            this._hasMulitpleSourcesInSearch = false;
          }
          //Set layers for attributeSearch from the search sources which are configured for proximity also.
          this._setLayersForAttributeSearch(this._searchInstance.search.sources);
          this._onWindowResize();
        }), 1000);
      })));
      // once widget is created call its startup method
      this._searchInstance.startup();
    },

    /**
    * This function is used to get the last focus node of main screen
    * -- memberOf widgets/EpaTracer/Widget
    */
    _getMainScreenLastNode: function () {
      var lastFocusNode;
      lastFocusNode = this._searchInstance.search.submitNode;
      if (this.config.showCurrentLocationTool) {
        lastFocusNode = this.currentLocationNode;
      }
      if (this.config.showLocationTool) {
        lastFocusNode = this.selectLocation;
      }
      if (!domClass.contains(this.bufferOptionParentNode, "esriCTHidden")) {
        if (this._bufferTextbox && !domClass.contains(this.bufferTextboxParentNode, "esriCTHidden")) {
          lastFocusNode = this._bufferTextbox.domNode;
        }
        var horizontalSliderNode = query(".esriCTSliderDiv", this.widgetMainNode);
        if (horizontalSliderNode && !domClass.contains(horizontalSliderNode[0], "esriCTHidden")) {
          lastFocusNode = this._slider.sliderHandle;
        }
      }
      //if apply filter node is visible the set last node from it
      if (!domClass.contains(this.applyFilterNode, "esriCTHidden")) {
        if (this.applyFilterArrowNode) {
          lastFocusNode = this.applyFilterArrowNode;
        }
        if (domClass.contains(this.clearAllFilterButton, "esriCTClearAllFilterActive")) {
          lastFocusNode = this.clearAllFilterButton;
        }
        if (!domClass.contains(this.filterListOuterDiv, "esriCTHidden")){
          lastFocusNode = this._filterList.getLastNode()
        }
      }

      if (this._itemListObject && this._itemListObject.filterButton &&
        domStyle.get(this._itemListObject.filterButton.parentElement, "display") === "block") {
        lastFocusNode = this._itemListObject.filterButton;
        this._lastFocusNodes.layerList = lastFocusNode;
        this._lastFocusNodes.featureList = lastFocusNode;
      }
      //
      this._lastFocusNodes.mainScreen = lastFocusNode;
      jimuUtils.initLastFocusNode(this.domNode, lastFocusNode);

      //Hack to overcome the issue of first focus node incase of link in search header
      //Check if search info section contains focusable node
      var node = jimuUtils.getFocusNodesInDom(this.searchHeaderTextNode);
      if (node && node.length > 0) {
        jimuUtils.initFirstFocusNode(this.domNode, node[0]);
      }
    },

    /**
    * This function initialize the Locate Button widget for using users current location
    * -- memberOf widgets/EpaTracer/Widget
    */
    _createCurrentLocationInstance: function () {
      //Check of app is running in https mode
      this.isNeedHttpsButNot = jimuUtils.isNeedHttpsButNot();
      if (jimuUtils.isNeedHttpsButNot()) {
        this.config.showCurrentLocationTool = false;
      }
      //if show location is enabled then only create current location button
      if (this.config.showCurrentLocationTool) {
        domClass.remove(this.currentLocationNode, "esriCTHidden");
        this._geoLocateInstance = new LocateButton({
          highlightLocation: false,
          map: this.map
        }, domConstruct.create("div", {}, this.currentLocationNode));
        this.own(on(this._geoLocateInstance, "locate", lang.hitch(this, function (result) {
          //if current location returns valid result init the workflow
          //else if it has any error show it
          if (result && result.graphic && result.graphic.geometry) {
            this._initWorkflow({
              "feature": new Graphic(result.graphic.geometry),
              "isFeatureFromMapClick": true
            });
          } else if (result.error && result.error.message) {
            this._showMessage(result.error.message);
          }
        })));
        //set aria-lable to locate button
        if(this._geoLocateInstance._locateNode) {
          domAttr.set(this._geoLocateInstance._locateNode,  "aria-label", this.nls.selectLocationToolTip);
        }
      }
    },

    /**
    * This function initialize the Locator widget for reverse geocoding
    * -- memberOf widgets/EpaTracer/Widget
    */
    _initReverseGeocoder: function () {
      var geocoderUrl;
      //set the first geocoder from configured search source settings for reverse geocoding
      if (this.config.searchSourceSettings && this.config.searchSourceSettings.sources) {
        array.some(this.config.searchSourceSettings.sources, lang.hitch(this, function (source) {
          //if selected source is geocoder create geocoder source else feature layer
          if (source && source.url && source.type === 'locator') {
            geocoderUrl = source.url;
            return true;
          }
        }));
        if (geocoderUrl) {
          this._loading.show();
          //get spatial ref of geocoder and the initiate Locator
          esriRequest({
            url: geocoderUrl,
            content: {
              f: 'json'
            },
            handleAs: 'json',
            callbackPrams: 'callback'
          }).then(lang.hitch(this, function (geocoderInfo) {
            this._loading.hide();
            this._geocoderSpatialRef = new SpatialReference(geocoderInfo.spatialReference);
            //create the locator instance to reverse geocode the address
            this._locatorInstance = new Locator(geocoderUrl);
            this.own(this._locatorInstance.on("location-to-address-complete", lang.hitch(
              this, this._onLocationToAddressComplete)));
          }));

        }
      }
    },

    /**
    * Callback handler called once location is reverse geocoded
    * -- memberOf widgets/EpaTracer/Widget
    */
    _onLocationToAddressComplete: function (result) {
      var screenPoint, infoTemplate, addressString, attributes, selectedLocationGraphic;
      //check if address available
      if (result.address && result.address.address) {
        if (result.address.address.Match_addr) {
          addressString = result.address.address.Match_addr;
        } else {
          addressString = "";
          for (var key in result.address.address) {
            if (key !== "Loc_name" && result.address.address[key]) {
              addressString += result.address.address[key] + " ";
            }
          }
          addressString = lang.trim(addressString);
        }
        //set the matched address in search textbox
        if (this._searchInstance) {
          this._searchInstance.setSearchText(addressString);
        }
        //create info-template
        infoTemplate = new InfoTemplate();
        infoTemplate.setContent("${Match_addr}");
        infoTemplate.setTitle(this.nls.searchLocationTitle);
        //create attribute object
        attributes = { "Match_addr": addressString };

        //create selected location graphic for infowindow
        selectedLocationGraphic = new Graphic(
            this._searchedLocation.geometry, null, attributes, infoTemplate);

        //clears previous features of the infowindow
        this.map.infoWindow.clearFeatures();
        //set feature
        this.map.infoWindow.setFeatures([selectedLocationGraphic]);

        setTimeout(lang.hitch(this, function () {
          //show infowindow on selected location
          screenPoint = this.map.toScreen(selectedLocationGraphic.geometry);
          this.map.infoWindow.show(screenPoint, this.map.getInfoWindowAnchor(
            screenPoint));
          this.map.infoWindow.isShowing = true;
        }), 500);
      }
    },

    /**
    * This function handles different event required for widget
    * -- memberOf widgets/EpaTracer/Widget
    */
    _connectSelectLocationHandler: function () {
      //handle select location button click event
      on(this.selectLocation, "click", lang.hitch(this, function () {
        this._selectLocationButtonClicked();
      }));
      on(this.selectLocation, "keydown", lang.hitch(this, function (evt) {
        if (evt.keyCode === keys.ENTER || evt.keyCode === keys.SPACE) {
          this._selectLocationButtonClicked();
        }
      }));
    },

    _selectLocationButtonClicked: function () {
      if (domClass.contains(this.selectLocation, "esriCTSelectLocationActive")) {
        this._disconnectMapEventHandler();
      } else {
        domClass.replace(this.selectLocation,
          "esriCTSelectLocationActive", "esriCTSelectLocation");
        this._connectMapEventHandler();
      }
    },

    /**
    * This function initialize the search widget
    * -- memberOf widgets/EpaTracer/Widget
    */
    _initWorkflow: function (evt, attribteSearchResult) {
      var selectedFeature, horzontalSliderNode;
      //hide filter list if it is opened and user is updating search location
      this._hideFilterListBeforeInitWorkflow();
      //clear previous results
      //If showing results of attributeSearch pass false to hide infowindow else pass true
      this._clearResults(!attribteSearchResult);
      this._doAttributeSearchOn = [];
      //get selected feature
      selectedFeature = this._getSelectedFeatureFromResult(evt);
      //store the current params which can be used if filters are applied later on
      this._prevAttributeSearchResult = lang.clone(attribteSearchResult);
      this._prevFeature = {
        "feature": selectedFeature,
        "isFeatureFromMapClick": selectedFeature ? evt.isFeatureFromMapClick : false
      };
      this._searchedLocation = selectedFeature;
      if (evt && evt.source && evt.source.zoomScale) {
        this._prevFeature.zoomScale = evt.source.zoomScale;
      }
      //if feature is form map click show the reverse geocoded address
      if (evt && this._locatorInstance && evt.isFeatureFromMapClick && this._searchedLocation &&
        this._searchedLocation.geometry) {
        this.showReverseGeocodedAddress();
      }
      //If selected feature is valid then init workflow to search
      //else if have valid attributeSearchList then display layers list accordingly
      if (selectedFeature && selectedFeature.geometry) {
        //show error message if no popup's are configured for any layers
        if (this._itemListObject.hasValidLayers()) {
          //show selected location on map
          this._highlightSelectedLocation(selectedFeature);
          //Display buffer only if slider/bufferTextbox is visible
          if (domClass.contains(this.bufferOptionParentNode, "esriCTHidden")) {
            this.zoomToFeature();
            this._itemListObject.displayLayerList(this._searchedLocation, null);
          }
          else {
            // Convert user-supplied location to lat/long and submit that 
            // point-geometry the EPA's point-indexing service.
            console.debug("selectedFeature.geometry, in Web Mercator",selectedFeature.geometry);
            var mp = esri.geometry.webMercatorToGeographic(selectedFeature.geometry);
            console.debug("selectedFeature.geometry, in lat/long",mp);
            var thiswkt = "POINT(" + mp.x.toString() + " " + mp.y.toString() + ")";
            console.log(thiswkt);
            
            // // Run EPA's WATERS upstream/downstream trace tool.
            // this.epaFindNearestStream(thiswkt);
            this.runWorkflow(thiswkt);
          }
        }
        else {
          this._showMessage(this.nls.allPopupsDisabledMsg);
        }
      } else if (attribteSearchResult) {
        //show error message if no popup's are configured for any layers
        if (this._itemListObject.hasValidLayers()) {
          this._itemListObject.displayLayerList(null, null, attribteSearchResult);
        }
        else {
          this._showMessage(this.nls.allPopupsDisabledMsg);
        }
      }
    },

    /**
    * Run workflow!  This is the part of the widget that works with EPA services.
    *
    * Process the work-flow. Once the EPA tracer is called, the service 
    * queue is checked, recursively, until a result or error is returned. 
    * Once results are returned the following routines will be called, in order:
    *   epaFetchResults,
    *   epaProcessResults,
    *   epaCreateFlowlineGraphics,
    *   createFlowlineBuffer
    * @function runWorkflow
    * @param {string} thiswkt Point-geometry for start of search, in well-known text.
    **/
    runWorkflow: function(thiswkt) {
      // Run EPA's WATERS upstream/downstream trace tool.
      this.epaFindNearestStream(thiswkt)
      .then(lang.hitch(this, this.epaTraceUpstream))
      .then(lang.hitch(this, this.epaCheckResultsQueueInitial))
      .then(lang.hitch(this, this.epaCheckResultsQueueRecursive))
      .catch(lang.hitch(this, function (err) {
        console.debug("runWorkflow error is ", err);
      }));
    },
    
    /**
    * This function will clear results
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _clearResults: function (showInfoWindow) {
      if (this._highlightGraphicsLayer) {
        this._highlightGraphicsLayer.clear();
      }
      this._searchedLocation = null;
      if (this._itemListObject) {
        this._itemListObject.clearResultPanel();
      }
      if (this._bufferGraphicLayer) {
        this._bufferGraphicLayer.clear();
      }
      if (!showInfoWindow) {
        this.map.infoWindow.hide();
      }
    },

    /**
    * This function will connects the map event
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _connectMapEventHandler: function () {
      if (!this._mapClickHandler) {
        this._disableWebMapPopup();
        //handle map click
        this._mapClickHandler = this.own(this.map.on("click", lang.hitch(this,
          this._onMapClick)))[0];
        //handle mouse move on map to show tooltip only on non-touch devices
        if ("ontouchstart" in document.documentElement) {
          domStyle.set(this._mapTooltip, "display", "none");
        } else {
          this._mapMoveHandler = this.own(this.map.on("mouse-move", lang.hitch(
            this, this._onMapMouseMove)))[0];
          this.own(this.map.on("mouse-out", lang.hitch(this, function () {
            domStyle.set(this._mapTooltip, "display", "none");
          })));
        }
      }
    },

    /**
    * On map click init the workflow, and reverse geocode the address
    * to show in infowindow at the selected location.
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _onMapClick: function (evt) {
      if (this.config.showLocationTool) {
        this._disconnectMapEventHandler();
      }
      this.map.infoWindow.hide();
      //on map click clear the previous text in search textbox
      if (this._searchInstance) {
        this._searchInstance.clearSearchText();
      }
      this._initWorkflow({
        "feature": new Graphic(evt.mapPoint),
        "isFeatureFromMapClick": true
      });
    },

    /**
    * On map mouse move update the toolTip position
    * to show in infowindow at the selected location.
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _onMapMouseMove: function (evt) {
      // update the tooltip as the mouse moves over the map
      var px, py;
      if (evt.clientX || evt.pageY) {
        px = evt.clientX;
        py = evt.clientY;
      } else {
        px = evt.clientX + document.body.scrollLeft -
          document.body.clientLeft;
        py = evt.clientY + document.body.scrollTop - document
          .body.clientTop;
      }
      domStyle.set(this._mapTooltip, "display", "none");
      domStyle.set(this._mapTooltip, {
        left: (px + 15) + "px",
        top: (py) + "px"
      });
      domStyle.set(this._mapTooltip, "display", "");
    },

    /**
    * This function will disconnects the map events
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _disconnectMapEventHandler: function () {
      this._enableWebMapPopup();
      domClass.replace(this.selectLocation, "esriCTSelectLocation",
        "esriCTSelectLocationActive");
      if (this._mapClickHandler) {
        this._mapClickHandler.remove();
        this._mapClickHandler = null;
      }
      if (this._mapMoveHandler) {
        this._mapMoveHandler.remove();
        this._mapMoveHandler = null;
        this._mapTooltip.style.display = "none";
      }
    },

    /**
    * This function will enable the web map popup.
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _enableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(true);
      }
    },

    /**
    * This function will disable the web map popup.
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _disableWebMapPopup: function () {
      if (this.map) {
        this.map.setInfoWindowOnClick(false);
      }
    },

    /**
    * This function create horizontal slider and set minimum maximum value of slider
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _createSlider: function () {
      // initialize and set the parameter of slider
      this._slider = new HorizontalSlider({
        name: "slider",
        showButtons: false,
        discreteValues: this.config.maxBufferDistance + 1,
        minimum: 0,
        maximum: this.config.maxBufferDistance,
        value: this.config.defaultBufferDistance,
        intermediateChanges: true,
        "class": "esriCTHorizantalSlider",
        "aria-label": this.nls.bufferDistanceLabel 
      }, this.horizantalSliderContainer);

      this._bufferTextbox = new NumberTextBox({
        constraints: {
          min: 0,
          max: this.config.maxBufferDistance
        },
        required: true,
        value: this.config.defaultBufferDistance,
        "class": "esriCTBufferTextbox",
        "aria-label": this.nls.bufferDistanceLabel
      }, this.bufferTextboxNode);


      this._bufferParams = {
        BufferDistance: this._slider.value.toString(),
        BufferUnit: this.nls.units[this.config.bufferDistanceUnit.value].displayText
      };

      // set slider text to show unit and value
      domAttr.set(this.silderText, "innerHTML", string.substitute(
        this.nls.bufferSliderText, this._bufferParams));

      //Set buffertextboxText value to show configured unit
      domAttr.set(this.bufferTextboxText, "innerHTML", string.substitute(
        this.nls.bufferTextboxLabel, this._bufferParams));

      this.own(on(this._bufferTextbox, "keydown", lang.hitch(this, function (evt) {
        if (evt.keyCode === keys.ENTER) {
          this._bufferTextboxChange();
        }
      })));
      this.own(on(this._bufferTextbox, "blur", lang.hitch(this, function () {
        this._bufferTextboxChange();
      })));

      // on change event of slider
      this.own(this._slider.on("change", lang.hitch(this, this._sliderChange)));
      // set maximum and minimum value of horizontal slider
      this.sliderMinValue.innerHTML = this._slider.minimum.toString();
      this.sliderMaxValue.innerHTML = this._slider.maximum.toString();
    },

    /**
    * Call back for slider change event
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _bufferTextboxChange: function () {
      if (this._bufferTextbox.isValid()) {
        var bufferDistance = this._bufferTextbox.getValue();
        this._slider.set("value", bufferDistance);
      } else {
        this._showMessage(this.nls.invalidBufferDistance);
      }
    },

    /**
    * Call back for slider change event
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _sliderChange: function (value) {
      var sliderResult;
      sliderResult = parseFloat(value, 10);
      if (isNaN(sliderResult)) {
        return;
      }
      this._bufferParams.BufferDistance = sliderResult;
      domAttr.set(this.silderText, "innerHTML", string.substitute(
        this.nls.bufferSliderText, this._bufferParams));
        this._bufferTextbox.set("value", sliderResult); //textbox chnages
      if (this._sliderChangeTimer) {
        clearTimeout(this._sliderChangeTimer);
      }
      // if geometry exists
      if (this._searchedLocation) {
        this._loading.show();
      }
    },

    /**
    * Create and initialize the upstream-search-distance controls.
    * @function _createUpstreamDistance
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _createUpstreamDistance: function () {
      // initialize and set UI for upstream-search parameters 
      this._upstreamDistanceTextbox = new NumberTextBox({
        constraints: {
          //min: 0,
          min: 1,
          max: this.config.maxUpstreamDistance
        },
        required: true,
        value: this.config.defaultUpstreamDistance,
        "class": "esriCTBufferTextbox",
        "aria-label": this.nls.upstreamDistanceLabel
      }, this.upstreamDistanceTextboxNode);
    
      this._upstreamDistanceParams = {
        //BufferDistance: this._slider.value.toString(),
        UpstreamUnit: this.nls.units[this.config.upstreamDistanceUnit.value].displayText
      };

      //Set buffertextboxText value to show configured unit
      domAttr.set(this.upstreamDistanceTextboxText, "innerHTML", string.substitute(
         this.nls.upstreamDistanceTextboxLabel, this._upstreamDistanceParams));
        
      this.own(on(this._upstreamDistanceTextbox, "keydown", lang.hitch(this, function (evt) {
        if (evt.keyCode === keys.ENTER) {
          this._upstreamDistanceTextboxChange();
        }
      })));
      this.own(on(this._upstreamDistanceTextbox, "blur", lang.hitch(this, function () {
        this._upstreamDistanceTextboxChange();
      })));
    },
    
    /**
    * Validate upstream-search-distance.
    *
    * @function _upstreamDistanceTextboxChange
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _upstreamDistanceTextboxChange: function () {
      if (!this._upstreamDistanceTextbox.isValid()) {
        this._upstreamDistanceTextbox.set("value", 1);
        this._showMessage(this.nls.invalidUpstreamDistance);
      }
    },
    
    /**
    * Returns the reverse geocoding address
    * -- memberOf widgets/EpaTracer/Widget
    **/
    showReverseGeocodedAddress: function () {
      if (this._geocoderSpatialRef && this._locatorInstance) {
        this.getProjectedGeometry(this._searchedLocation.geometry, this._geocoderSpatialRef).then(
          lang.hitch(this, function (geometry) {
            this._locatorInstance.locationToAddress(geometry, 100);
          }));
      }
    },

    /**
    * Returns the projected geometry in outSR
    * -- memberOf widgets/EpaTracer/Widget
    **/
    getProjectedGeometry: function (geometry, outSR) {
      var deferred, result, geometryService;
      geometryService = new GeometryService(this.config.helperServices.geometry.url);
      deferred = new Deferred();
      if (webMercatorUtils.canProject(geometry, outSR)) {
        result = webMercatorUtils.project(geometry, outSR);
        deferred.resolve(result);
      } else {
        geometryService.project([geometry], outSR, function (projectedGeometries) {
          result = projectedGeometries[0];
          deferred.resolve(result);
        });
      }
      return deferred.promise;
    },
    
    /**
    * Translate user-click (or measuring location) to stream 
    * address using EPA's WATERS point-indexing tool.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @see https://www.epa.gov/waterdata/point-indexing-service
    * @async
    * @function epaFindNearestStream
    * @param {string} wkt Point-geometry for start of search, in well-known text.
    * @return {Promise<var>} Point on the NHD flowline nearest the search-location.
    **/
    epaFindNearestStream: function(wkt) {
      console.log("Inside epaFindNearestStream");
      this._loading.show();
      this.hideDownloadButton();
      
      var pmethod = "Distance Snap";
      var pdist = 2;    // max distance (KM) to snap to a qualifying NHDPlus flowline. This is the default.
      
      var data = {
        "pGeometry": wkt,
        "pGeometryMod": "WKT,SRSNAME=urn:ogc:def:crs:OGC::CRS84",
        "pPointIndexingMethod": pmethod,
        "pPointIndexingMaxDist": pdist,
        "pOutputPathFlag": "TRUE",
        "pReturnFlowlineGeomFlag": "TRUE",
        "optOutCS": "SRSNAME=urn:ogc:def:crs:OGC::CRS84",
        "optOutPrettyPrint": 0,
        "optClientRef": "none"
      };
      
      var args = {
        url: this.epaServiceUrl + 'PointIndexing.Service',
        content: data,
        handleAs: 'json',
        callbackParamName: 'callback'
      };

      console.debug("In epaFindNearestStream. args are", args);
      return new esriRequest(args, {
        usePost: false
      });
    },
    
    /**
    * Traverse, upstream, the NHDPlus stream network using 
    * the EPA's WATERS upstream/downstream trace tool.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @see https://www.epa.gov/waterdata/upstreamdownstream-search-service
    * @async
    * @function epaTraceUpstream
    * @param {object} response Response from request to EPA point-indexing service.
    * @return {Promise<var>} Return the stream-network for the specified ComId.
    **/
    epaTraceUpstream: function(response) {
      console.debug("Inside epaTraceUpstream where response.output is ", response.output);

      var prevEpaResponse = response.output;
      if (prevEpaResponse == null || prevEpaResponse.ary_flowlines == null || prevEpaResponse.ary_flowlines.length == 0) {
        if (response.status.status_message !== null) {
          console.debug("Inside epaTraceUpstream; status is ", response.status.status_message);
        } else {
          console.debug("Inside epaTraceUpstream; status - No results were found.");
        }
        this._loading.hide();
        this._showMessage(this.nls.epaTracingUnnavigableStreamMsg);
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        return false;
      }
      console.log("Inside epaTraceUpstream - results were found");

      var comid = prevEpaResponse.ary_flowlines[0].comid;
      var measure = prevEpaResponse.ary_flowlines[0].fmeasure;
      var navigable = prevEpaResponse.ary_flowlines[0].navigable;

      if (navigable == "N") {
        // From the original codePen "Flowline cannot currently be navigated using NHDPlus flow information."
        this._loading.hide();
        this._showMessage(this.nls.epaTracingUnnavigableStreamMsg);
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        return false;
      }
      console.log("Inside epaTraceUpstream - stream is navigable");

     // Make up for user's data entry error.
     if (this._upstreamDistanceTextbox.value < 1) {
       this._upstreamDistanceTextbox.set("value", 1);
     }

      // Convert upstreamDistanceUnit to Km.
      var cvt = 1.0;
      switch (this.config.upstreamDistanceUnit.value) {
          case "miles":
            cvt = 1.60934;
            break;
          case "meters":
            cvt = 0.001;
            break;
          case "feet":
            cvt = 0.0003048;
            break;
      }

      // The validating routine is not fired in time to keep the routine 
      // from sending an errant request to EPA's server...fix that.
      var maxdist = this._upstreamDistanceTextbox.value;
      if (this._upstreamDistanceTextbox.isValid()) {
        maxdist = maxdist * cvt; // convert to kilometers.
      } else {
        this._loading.hide();
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        return false;
      }

      var data = {
        "pNavigationType": "UT",    // Upstream with Tributaries
        "pStartComid": comid,
        "pStartMeasure": measure,
        "pTraversalSummary": "TRUE",
        "pFlowlinelist": "TRUE",
        "pEventList": "10030",      // USGS Streamgages
        "pEventListMod": ",",
        "pStopDistancekm": maxdist,
        "optQueueResults": "THREADED",
        "optOutPruneNumber": 8,
        "optOutCS": "SRSNAME=urn:ogc:def:crs:OGC::CRS84",
        "optOutPrettyPrint": 0,
        "optClientRef": "none"
      };
      var args = {
        url: this.epaServiceUrl + 'UpstreamDownstream.Service',
        content: data,
        handleAs: 'json',
        callbackParamName: 'callback'
      };

      // Use ESRI request module to call service via JSONP
      return new esriRequest(args, {
        usePost: false
      });
    },
    
    /**
    * Call the ResultsQueue.Service endpoint to get the results-queue response.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @async
    * @function epaCheckResultsQueueInitial
    * @param {object} response Response from request to EPA up/downsteram tracing service.
    * @return {Promise<var>} Return the response from the initial check of the EPA job-queue.
    **/
    epaCheckResultsQueueInitial: function(response) {

      if (
        response == null || response == undefined || response.output == null || response.output == undefined
      ) {
        this._loading.hide();
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        this._showMessage(this.nls.epaTracerErrorMsg);
        return false;
      }

      this.epaResultsQueueId = response.output.queue_service_id;

      var data = {
        "pQueueUniqueID": this.epaResultsQueueId,
        "pAction": "GET STATUS"
      };
     
      var args = {
        url: this.epaServiceUrl + 'ResultsQueue.Service',
        content: data,
        handleAs: 'json',
        callbackParamName: 'callback'
      };

      return new esriRequest(args, {
        usePost: false
      });
    },

    /**
    * Call the EPA ResultsQueue.Service endpoint to request the status of upstream trace.
    * This function will call itself until it receives a status of "complete", indicating
    * that the job is done, or an error. If successful, this function calls epaFetchResults
    * to process the results from the EPA upstream-trace job.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @async
    * @function epaCheckResultsQueueRecursive
    * @param {object} response Response from request to EPA up/downsteram tracing service.
    * @return {Promise<var>} Return an error response if job failed.
    **/
    epaCheckResultsQueueRecursive: function(response, sleeping) {
        console.log("Inside epaCheckResultsQueueRecursive...where status is '" + response.output.queue_status + "'.");

      if (response == null || response == undefined || response.output == null || response.output == undefined) {
        this._loading.hide();
        this._showMessage(this.nls.epaTracerErrorMsg);
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        console.log("Inside epaCheckResultsQueueRecursive; encountered an error when checking the queue.");
        return false;
      }

      var thiss = this;
      if (response.output.queue_status == "processing") {
        if (sleeping == undefined || sleeping == null) {
          setTimeout(
            function() {
              thiss.epaCheckResultsQueueRecursive(response, "slept");
            }, 5000
          );

          console.log("Returning ***TRUE*** from epaCheckResultsQueueRecursive!");
          return true;

        } else {
          // Try again 
          var data = {
            "pQueueUniqueID": this.epaResultsQueueId,
            "pAction": "GET STATUS"
          };
          var args = {
            url: this.epaServiceUrl + 'ResultsQueue.Service',
            content: data,
            handleAs: 'json',
            callbackParamName: 'callback'
          };

          new esriRequest(args, {
            usePost: false
          }).then(lang.hitch(this, function (response) {
            // Call this (function), recursively.
            this.epaCheckResultsQueueRecursive(response);
          }), lang.hitch(this, function (err) {
            this._loading.hide();
            this._showMessage(this.nls.epaTracerErrorMsg);
            if (this._highlightGraphicsLayer) {
            this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
          }
          }));
        }

      } else if (response.output.queue_status == "complete") {
          // Go get the data from the EPA.
          this.epaFetchResults(response);
      } else {
        this._loading.hide();
        this._showMessage(this.nls.epaTracerErrorMsg);
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        return false;
      }
    },
    
    /**
    * Retrieve the data from the EPA's server.  Upon successfully retrieving the results, it
    * calls epaProcessResults to act on them.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @async
    * @function epaFetchResults
    * @param {object} response Response from the EPA up/downsteram tracing service.
    **/
    epaFetchResults: function(response){
      console.log("===== Processing is complete! =====");

      var data = {
        "pQueueUniqueID": this.epaResultsQueueId,
        "pAction": "FETCH HTTP"
      };
      var args = {
        url: this.epaServiceUrl + 'ResultsQueue.Service',
        content: data,
        handleAs: 'json',
        callbackParamName: 'callback'
      };

      new esriRequest(args, {
        usePost: false
      }).then(lang.hitch(this, function (response) {
        // The response from the server comes back as undefined if the pQueueUniqueID is bad!
        if (response) {
          this.epaProcessResults(response);
        } else {
          this._loading.hide();
          this._showMessage(this.nls.epaTracerErrorMsg);
          if (this._highlightGraphicsLayer) {
            this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
          }
        }
      }), lang.hitch(this, function (err) {
        console.debug("Error from ResultsQueue.Service is", err);
        this._loading.hide();
        this._showMessage(this.nls.epaTracerErrorMsg);
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        }));  
    },

    /**
    * Check for null response from EPA upstream trace service.  If non-null, call 
    * epaCreateFlowlineGraphics to process the "found" flow-lines.
    * The geometry is passed as an array of EPA "flowlines_traversed" JSON.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function epaProcessResults
    * @param {object} response Response from the EPA up/downsteram tracing service.
    **/
    epaProcessResults: function(response) {
      console.debug("insite epaProcessResults where response is ", response);

      var srv_rez = response.output;

      if (srv_rez == null) {
        this._loading.hide();
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
        if (response.status.status_message !== null) {
          console.debug("inside epaProcessResults where output is null and response.status.status_message is", response.status.status_message);
        } else {
          this._showMessage(this.nls.noFeatureFoundText);
        }

      } else {
        this.epaCreateFlowlineGraphics(response.output.flowlines_traversed);
      }
      this._loading.hide();
    },

    /**
    * Convert NHD flowlines returned from EPA's tracer to flowline graphics and then
    * call createFlowlineBuffer to create a buffer used to select diversions.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @async
    * @function epaCreateFlowlineGraphics
    * @param {object} flowlines Response from the EPA up/downsteram tracing service.
    **/
    epaCreateFlowlineGraphics: function(flowlines) {
        var paths = [[]];
        // Make sure that the response-geometry is a line.
        if (flowlines[0].shape.type == "LineString")
        {
          var i, j, il = flowlines.length, jl=-1;
          for (i=0; i<il; i++)
          {
            jl = flowlines[i].shape.coordinates.length;
            console.log("Processing " + jl + " coordinates.");
            paths[[i]] = flowlines[i].shape.coordinates;
          }
        }
        
        var geometry = new Polyline(paths);
        var symbol = {
          "color": [21, 21, 184, 255],
          "width": 3.75,
          "type": "esriSLS",
          "style": "esriSLSSolid"
        };

        var attrs = {
          "comid": flowlines[0].comid,
          "fcode": flowlines[0].fcode,
          "gnis_name": flowlines[0].gnis_name,
          "permanent_identifier": flowlines[0].permanent_identifier,"reachcode": flowlines[0].reachcode
        };
        var graphic = new Graphic(geometry, symbol, attrs);
        if (this._flowlinesGraphicsLayer) {
          this._flowlinesGraphicsLayer.clear();
        }
        this._flowlinesGraphicsLayer.add(graphic);
        
        // Make the download button available 
        this.showDownloadButton();

        // Create the buffer around these geometries.
        this.createFlowlineBuffer(geometry);
    },

    /**
    * Create a buffer surrounding the NHD flowlines returned from EPA's tracer and
    * draw that buffer's boundary on the map.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @async
    * @function createFlowlineBuffer
    * @param {object} geometry Geometry of "found" NHD flowlines.
    **/
    createFlowlineBuffer: function (geometry) {
      var params, geometryService;
      geometryService = new GeometryService(this.config.helperServices.geometry.url);
      if (this._bufferParams.BufferDistance > 0) {
        this._loading.show();
        //set the buffer parameters
        params = new BufferParameters();
        params.distances = [this._bufferParams.BufferDistance];
        params.unit = GeometryService[this.config.bufferDistanceUnit.bufferUnit];
        params.bufferSpatialReference = this.map.spatialReference;
        params.outSpatialReference = this.map.spatialReference;
        params.geometries = [geometry];
        //draw geodesic buffers if configured on map spatial ref is 4326
        if (this.config.isGeodesic || this.map.spatialReference.wkid === 4326) {
          this.config.isGeodesic = true;
          params.geodesic = true;
        }
        geometryService.buffer(params, lang.hitch(this, function (
          geometries) {
          this._showBuffer(geometries);
          this.map.setExtent(geometries[0].getExtent().expand(1.5));
          this._loading.hide();
          this._itemListObject.displayLayerList(this._searchedLocation,
            geometries[0]);
        }), lang.hitch(this, function () {
          this._showMessage(this.nls.unableToCreateBuffer);
          this.hideDownloadButton();
          this._loading.hide();
          if (this._highlightGraphicsLayer) {
            this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
          }          
        }));
      } else {
        this._bufferGraphicLayer.clear();
        if (!this._prevFeature.isFeatureFromMapClick) {
          this.zoomToFeature();
        }
        this._itemListObject.displayLayerList(this._searchedLocation, null);
        this.hideDownloadButton();
        this._loading.hide();
        if (this._highlightGraphicsLayer) {
          this._highlightGraphicsLayer.clear(); // Get rid of "Fire-fly" symbol at map-click point.
        }
      }
    },

    showError(msg) {
        this.hideDownloadButton();
    },
    
    showDownloadButton: function() {
      domClass.remove(this.downloadItemsNode, "esriCTHidden");
    },
    
    hideDownloadButton: function() {
      domClass.add(this.downloadItemsNode, "esriCTHidden");
    },
    
    /**
    * Create the CSV-format files and offer them to the client.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function createCsv
    * @param {object} featureObjs 
    * @param {object} diversionLayerDetails 
    **/
    createCsv: function(featureObjs, diversionLayerDetails) {
      var outSR = new SpatialReference(4326);
      var outputFileName = "";
      var found = -1;
      
      // Retrieve the names of the layers...used for CSV-file-names.
      var i, il = diversionLayerDetails.length;
      for (i=0; i<il; i++) {
        console.debug("diversionLayerDetails details = ",diversionLayerDetails[i].id, diversionLayerDetails[i].title);
      }

      var thiss = this;
      Object.keys(featureObjs).forEach(function(key) {
        console.debug("First", key, featureObjs[key]);
        var theseFeatures = featureObjs[key];
        
        found = -1;
        
        for (i=0; i<il; i++) {
          if (key == diversionLayerDetails[i].id) {
              found = i;
          }
        }
          
        if (found > -1)  {
          thiss._exportToCSV(theseFeatures, diversionLayerDetails[found]);
        }
      });
    },

    /**
    * Export the CSV-format files to the client.
    *
    * @see Esri's WAB Screening download widget.
    * -- memberOf widgets/EpaTracer/Widget
    * @function _exportToCSV
    * @param {object} features Features to export. 
    * @param {object} layer ArcGIS Server map service layer object. 
    **/
    _exportToCSV: function (features, layer) {
      var data, options = {}, popupInfo;

      options = {};

      data = this._getLayerData(layer, features);
      data = dojo.mixin({}, data); // jshint ignore:line
      popupInfo = this._getInfoTemplate(layer);
      if (data.graphicsArray.length > 0) {
        options.datas = data.graphicsArray;
        options.fromClient = false;
        options.withGeometry = layer.geometryType === 'esriGeometryPoint';
        options.outFields = data.outFields;
        options.formatNumber = false;
        options.formatDate = true;
        options.formatCodedValue = true;
        options.popupInfo = popupInfo;
        
        console.debug(options);

        CSVUtils.exportCSVFromFeatureLayer(
          layer.title || "CSV_FILE",
          layer, options);
      }
    },

    /**
     */
    /**
    * Fetch the features to prepare for download to the client.
    * Data are transformed from Web Mercator to lat/long.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function _getLayerData
    * @param {object} layer ArcGIS Server map service layer object. 
    * @param {object} features Features to export. 
    * @return {object} Featureset to be exported to client.
    **/     
    _getLayerData: function (layer, features) {
      var point = null, layerGraphics = [],
        pointLayerData;
      var outSR = new SpatialReference(4326);

      array.forEach(features, lang.hitch(this, function (graphic) {
        //graphic.attributes.geometry = graphic.geometry;
        
        if (webMercatorUtils.canProject(graphic.geometry, outSR)) {
          point = webMercatorUtils.project(graphic.geometry, outSR);
          console.debug("point is ", point);
          graphic.attributes.geometry = point;
          layerGraphics.push(graphic.attributes);
        }
      }));
      //export geometry if shape type of layer is point
      if (layer.geometryType === 'esriGeometryPoint') {
        pointLayerData = this._formatPointLayerData(layerGraphics, layer);
        return {
          graphicsArray: pointLayerData.layerGraphics,
          outFields: pointLayerData._outFields
        };
      } else {
        return {
          graphicsArray: layerGraphics,
          outFields: layer.fields
        };
      }
    },

    /**
    * Format the point layer data to include x and y parameters.
    * Data are transformed from Web Mercator to lat/long.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function _formatPointLayerData
    * @param {object} layerGraphics Graphics (features) to export. 
    * @param {object} layer ArcGIS Server map service layer object. 
    * @return {object} Featureset to be exported to client.
    **/  
    _formatPointLayerData: function (layerGraphics, layer) {
      var data_set, _outFields, pointLayerData = {};
      data_set = lang.clone(layerGraphics);
      _outFields = layer.fields;
      array.forEach(data_set, function (d) {
        var geometry = d.geometry;
        if (geometry && geometry.type === 'point') {
          if ('x' in d) {
            d._x = geometry.x;
          } else {
            d.x = geometry.x;
          }

          if ('y' in d) {
            d._y = geometry.y;
          } else {
            d.y = geometry.y;
          }
        }

        delete d.geometry;
      });
      layerGraphics = data_set;
      _outFields = lang.clone(_outFields);
      var name = "";
      if (_outFields.indexOf('x') !== -1) {
        name = '_x';
      } else {
        name = 'x';
      }
      //    'places': 6
      _outFields.push({
        'name': name,
        alias: name,
        format: {
          'digitSeparator': false,
          'places': 4
        },
        show: true,
        type: "esriFieldTypeDouble"
      });
      if (_outFields.indexOf('y') !== -1) {
        name = '_y';
      } else {
        name = 'y';
      }
      _outFields.push({
        'name': name,
        alias: name,
        format: {
          'digitSeparator': false,
          'places': 4
        },
        show: true,
        type: "esriFieldTypeDouble"
      });
      pointLayerData.layerGraphics = layerGraphics;
      pointLayerData._outFields = _outFields;
      return pointLayerData;
    },

    /**
    * Get the infoTemplate for an ArcGIS Server map service.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function _getInfoTemplate
    * @param {object} layer ArcGIS Server map service layer object. 
    * @return {object} infoTemplate for layer.
    **/  
    _getInfoTemplate: function (layer) {
      var layerId, parentLayerId, layerInstance;
      if (layer.infoTemplate) {
        return layer.infoTemplate.info;
      } else {
        layerId = layer.id.split("_");
        if (layerId[layerId.length - 1] === layer.layerId.toString()) {
          layerId.pop();
          parentLayerId = layerId.join("_");
        }
        if (parentLayerId) {
          layerInstance = this.map.getLayer(parentLayerId);
        }
        if (layerInstance && layerInstance.infoTemplates &&
          layerInstance.infoTemplates.hasOwnProperty(layer.layerId)) {
          return layerInstance.infoTemplates[layer.layerId].infoTemplate.info;
        } else {
          return null;
        }
      }
    }, 

    /**
    * Zoom to the extent of all found features.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function _getInfoTemplate
    * @param {object} layer ArcGIS Server map service layer object. 
    * @return {object} infoTemplate for layer.
    **/
    zoomToFeature: function () {
      var extent, zoomScale, featureGeometry;
      featureGeometry = this._prevFeature.feature.geometry;
      //check if selected search location is point or not
      if (featureGeometry.type === "point") {
        //get the configured zoomScale
        if (this._prevFeature.hasOwnProperty('zoomScale')) {
          zoomScale = this._prevFeature.zoomScale;
        }
        //check if current map scale is out of zoomScale
        if (zoomScale && this.map.getScale() > zoomScale) {
          extent = scaleUtils.getExtentForScale(
            this.map, this._prevFeature.zoomScale).centerAt(featureGeometry);
        } else {
          extent = this.map.extent.centerAt(featureGeometry);
          if (!extent) {
            extent = this.pointToExtent(this.map, featureGeometry, 20);
          }
        }
      } else {
        //in case of geometries other than point get the extent of geometry
        extent = featureGeometry.getExtent().expand(1.5);
      }
      //set map extent to the calculated extent
      if (extent) {
        this.map.setExtent(extent);
      }
    },

    /**
    * Create map-extent for a single point.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function pointToExtent
    * @param {object} map Current map object. 
    * @param {object} point  
    * @param {object} toleranceInPixel Number of map-pixels to expand extent. 
    * @return {object} New extent.
    **/
    pointToExtent: function (map, point, toleranceInPixel) {
      //calculate map coords represented per pixel
      var pixelWidth = map.extent.getWidth() / map.width;
      //calculate map coords for tolerance in pixel
      var toleranceInMapCoords = toleranceInPixel * pixelWidth;
      //calculate & return computed extent
      console.log("============ Inside pointToExtent...computing new extent.")
      return new Extent(point.x - toleranceInMapCoords,
        point.y - toleranceInMapCoords,
        point.x + toleranceInMapCoords,
        point.y + toleranceInMapCoords,
        map.spatialReference);
    },
    
    /**
    * Show buffer on map if buffer visibility is set to true in config.
    *
    * -- memberOf widgets/EpaTracer/Widget
    * @function _showBuffer
    * @param {object} bufferedGeometries Geometries to be added to map. 
    **/
    _showBuffer: function (bufferedGeometries) {
      if (this.config.bufferInfo && this.config.bufferInfo.isVisible) {
        this._bufferGraphicLayer.clear();
        if (this.config && this.config.symbols && this.config.symbols.bufferSymbol) {
          var symbol = symbolJsonUtils.fromJson(this.config.symbols.bufferSymbol);
          array.forEach(bufferedGeometries, lang.hitch(this, function (geometry) {
            var graphic = new Graphic(geometry, symbol);
            this._bufferGraphicLayer.add(graphic);
          }));
        }
      }
    },
    
    /**
    * Set the selected feature from results
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _getSelectedFeatureFromResult: function (evt) {
      var selectedFeature;
      if (evt) {
        if (evt.feature) {
          selectedFeature = evt.feature;
        } else if (evt.result && evt.result.feature) {
          selectedFeature = evt.result.feature;
        }
      }
      return selectedFeature;
    },

    /**
    * Function to highlight features on map
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _highlightSelectedLocation: function (selectedFeature) {
      var symbol;
      if (selectedFeature) {
        this._highlightGraphicsLayer.clear();
        // set the graphic symbol for selected geometry based on type and highlight on map
        if (selectedFeature.geometry.type === "polygon") {
          symbol = symbolJsonUtils.fromJson(this.config.symbols.polygonSymbol);
        } else if (selectedFeature.geometry.type === "polyline") {
          symbol = symbolJsonUtils.fromJson(this.config.symbols.polylineSymbol);
        } else {
          symbol = symbolJsonUtils.fromJson(this.config.symbols.graphicLocationSymbol);
        }
        this._highlightGraphicsLayer.add(new Graphic(selectedFeature.geometry, symbol));
      }
    },

    /**
    * Window resize handler
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _onWindowResize: function () {
      if (this._windowResizeTimer) {
        clearTimeout(this._windowResizeTimer);
      }
      this._windowResizeTimer = setTimeout(lang.hitch(this, this._resetComponents),
        500);
    },

    /**
    * Resets the components of the widgets according to updated size
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _resetComponents: function () {
      var containerGeom, calculatedWidth, searchGroup, componentsWithScrollingTouch = [];
      //get search group to override max width overridden by some themes
      searchGroup = query(
        ".arcgisSearch .searchGroup", this.domNode
      )[0];
      if (!this._searchContainerNodeElement) {
        this._searchContainerNodeElement = query(
          ".arcgisSearch .searchGroup .searchInput", this.domNode
        )[0];
      }
      //get information and direction tab parent
      componentsWithScrollingTouch = query(
        ".dijitContentPane", this.domNode
      );
      //get main widgets parent
      componentsWithScrollingTouch.push(this.domNode);
      //remove webkit-overflow-scrolling touch
      array.forEach(componentsWithScrollingTouch, lang.hitch(this, function (node) {
        domStyle.set(node, "-webkit-overflow-scrolling", "auto");
      }));
      //reset the width of search control to fit in available panel width
      if (this.widgetMainNode && this._searchContainerNodeElement) {
        containerGeom = domGeom.position(this.widgetMainNode);
        if (containerGeom && containerGeom.w) {
          calculatedWidth = (containerGeom.w - 144);
          //if search is not having multiple sources it will not display arrow
          if (!this._hasMulitpleSourcesInSearch) {
            calculatedWidth += 32;
          }
          if (calculatedWidth > 0) {
            //As some of the themes have overridden width of search widget and have applied important priority to it,
            //we need to use style.setProperty method instead of dojo domStyle.
            if (this.config.showLocationTool) {
              calculatedWidth = calculatedWidth - 45;
            }
            if (this.config.showCurrentLocationTool) {
              calculatedWidth = calculatedWidth - 45;
            }
            this._searchContainerNodeElement.style.setProperty('width',
              calculatedWidth + "px", 'important');
            if (searchGroup) {
              searchGroup.style.setProperty('max-width', "100%", 'important');
            }
          }
        }
      }
      //Add webkit-overflow-scrolling touch
      if (componentsWithScrollingTouch.length > 0) {
        setTimeout(lang.hitch(this, function () {
          array.forEach(componentsWithScrollingTouch, lang.hitch(this, function (node) {
            domStyle.set(node, "-webkit-overflow-scrolling", "touch");
          }));
        }), 500);
      }
      //resize the swiper
      if (this._itemListObject) {
        this._itemListObject.resetGallery();
      }
    },

    /**
    * Initialize item-list widget to display summary of results
    * -- memberOf widgets/EpaTracer/Widget
    **/
    _initLayerList: function () {
      this._itemListObject = new ItemList({
        map: this.map,
        config: this.config,
        nls: this.nls,
        loading: this._loading,
        parentDivId: this.id,
        folderUrl: this.folderUrl,
        outerContainer: this.layerListOuterDiv,
        searchOuterContainer: this.searchOuterContainer,
        selectedThemeColor: this.selectedThemeColor,
        domNodeObj: this.domNode,
        applyFilterNode: this.applyFilterNode,
        filterListMainDiv: this.filterListMainDiv
      });
      //on init-proximity call initWorkflow method,
      //to initiate proximity search around selected feature
      this.own(on(this._itemListObject, "init-proximity",
        lang.hitch(this, function (selectedFeature) {
          var evt = {};
          evt.isFeatureFromMapClick = false;
          evt.feature = selectedFeature;
          this._initWorkflow(evt);
        })));
      //Set last focus node based on the panel displayed
      this.own(on(this._itemListObject, "setLastNode",
        lang.hitch(this, function (panelName) {
          if (panelName === "layerListPanel") {
            if (!this._itemListObject.filterButton ||
              domStyle.get(this._itemListObject.filterButton.parentElement, "display") !==
              "block") {
              this._lastFocusNodes.layerList = query(".esriCTLastLayerFocusNode")[0];
            } else {
              this._lastFocusNodes.layerList = this._itemListObject.filterButton;
            }
            if (this._lastFocusNodes.layerList) {
              jimuUtils.initLastFocusNode(this.domNode, this._lastFocusNodes.layerList);
            }
          } else if (panelName === "featureListPanel") {
            if (!this._itemListObject.filterButton ||
              domStyle.get(this._itemListObject.filterButton.parentElement, "display") !==
              "block") {
              this._lastFocusNodes.featureList = query(".esriCTLastFeatureFocusNode")[0];
            }
            jimuUtils.initLastFocusNode(this.domNode, this._lastFocusNodes.featureList);
          }
        })));
      //Set last focus node in feature info panel
      this.own(on(this._itemListObject, "setLastNodeInFeatureInfo", lang.hitch(this,
        function (lastFocusNode) {
          jimuUtils.initLastFocusNode(this.domNode, lastFocusNode);
        })));
      //Set last focus node in the main screen when search returns no features
      this.own(on(this._itemListObject, "noFeatureFound", lang.hitch(this,
        function () {
          this._getMainScreenLastNode();
          jimuUtils.focusFirstFocusNode(this.domNode);
        })));
      // set focus on first focusable node
      this.own(on(this._itemListObject, 'setFocusOnFirstFocusableNode', lang.hitch(this, function () {
        if (this._searchInstance.search.sources.length === 1) {
          focusUtil.focus(this._searchInstance.search.inputNode);
        } else {
          focusUtil.focus(this._searchInstance.search.sourcesBtnNode);
        }
      })));
      if (this.id && registry.byId(this.id) && registry.byId(this.id).resize) {
        registry.byId(this.id).resize();
      }
    },

    /**
    * This function used for loading indicator
    * -- memberOf widgets/EpaTracer/Widget
    */
    _initLoading: function () {
      this._loading = new LoadingIndicator({
        hidden: true
      });
      this._loading.placeAt(this.domNode);
      this._loading.startup();
    },
   
    /**
    * Display buffer input option
    * -- memberOf widgets/EpaTracer/Widget
    */
    _displayBufferInputOptions: function () {
      // set buffer input option radio button
      if (this.config.bufferInputOption === "slider") {
        domClass.add(this.bufferTextboxParentNode, "esriCTHidden");
        //in case of slider add top margin to applyFilter node
        domClass.add(this.applyFilterNode, "esriCTApplyFilterDivSpacing");
      } else if (this.config.bufferInputOption === "textbox") {
        domClass.add(this.sliderParentNode, "esriCTHidden");
      } else if (this.config.bufferInputOption === "sliderAndTextbox") {
        domClass.add(this.silderText, "esriCTHidden");
        domClass.add(this.sliderParentNode, "esriCTOverrideSliderDiv");
      }
      domClass.remove(this.bufferOptionParentNode, "esriCTHidden");
    },

    /**
    * This function checks if all configured layers are
    * not polygon and intersectSearchedLocation flag
    * is disabled then it shows horizontal slider widget
    * -- memberOf widgets/EpaTracer/Widget
    */
    _setBufferSliderVisiblity: function () {
      var hideHorizontalSliderFlag = true, itemListMainContainer;
      // if layers are configured in configuration
      if (this.config.searchLayers && this.config.searchLayers.length > 0) {
        // looping through the configured layers
        array.some(this.config.searchLayers, lang.hitch(this, function (layer) {
          // if geometryType is other than esriGeometryPolygon
          // sets flag to false
          if (layer.geometryType !== "esriGeometryPolygon") {
            hideHorizontalSliderFlag = false;
            return false;
          }
        }));
        // if horizontal slider && intersectSearchedLocation flag is true
        // then resize item list container else show horizontal slider widget
        if (this.config.intersectSearchedLocation && hideHorizontalSliderFlag) {
          domClass.add(this.bufferOptionParentNode, "esriCTHidden");
          itemListMainContainer = query(".esriCTItemListMainContainer", this.domNode);
          if (itemListMainContainer) {
            if (this.config.bufferInputOption === "slider" ||
              this.config.bufferInputOption === "textbox") {
              domClass.add(itemListMainContainer[0], "esriCTItemListOverrideMainContainer");
            } else {
              domClass.add(itemListMainContainer[0],
                "esriCTItemListOverrideMainContainerForBothBufferOptions");
            }
          }
        } else {
          domClass.remove(this.bufferOptionParentNode, "esriCTHidden");
          //init last focus node based on current buffer option
          if (this.config.bufferInputOption === "textbox") {
            jimuUtils.initLastFocusNode(this.domNode, this._bufferTextbox.domNode);
          } else {
            jimuUtils.initLastFocusNode(this.domNode, this.horizantalSliderContainer);
          }
        }
        //update the height of list container
        //based on visibility of slider and other controls in search outer div
        if (this._itemListObject) {
          this._itemListObject.updateListHeight();
        }
      }
    },

    /***
     * Function gets the selected theme Color from app config and theme properties
     * In case of errors it will use "#000000" color
     */
    _getSelectedThemeColor: function (selectedThemeName, changeData) {
      var requestArgs, styleName, selectedTheme;
      //Get selected theme Name
      selectedTheme = this.appConfig.theme.name;
      if (changeData) {
        selectedTheme = selectedThemeName;
      }
      //get selected theme's style
      if (this.appConfig && this.appConfig.theme && this.appConfig.theme.styles) {
        styleName = this.appConfig.theme.styles[0];
      } else {
        styleName = "default";
      }
      if (changeData) {
        styleName = changeData;
      }
      //if custom styles are selected then use the selected color directly
      if (this.appConfig && this.appConfig.theme && this.appConfig.theme.customStyles &&
        this.appConfig.theme.customStyles.mainBackgroundColor && (!changeData)) {
        this.selectedThemeColor = this.appConfig.theme.customStyles.mainBackgroundColor;
        return;
      }
      //create request to get the selected theme's manifest to fetch the color
      requestArgs = {
        url: "./themes/" + selectedTheme + "/manifest.json",
        content: {
          f: "json"
        },
        handleAs: "json",
        callbackParamName: "callback"
      };
      esriRequest(requestArgs).then(lang.hitch(this, function (response) {
        var i, styleObj;
        //match the selected style name and get its color
        if (response && response.styles && response.styles.length > 0) {
          for (i = 0; i < response.styles.length; i++) {
            styleObj = response.styles[i];
            if (styleObj.name === styleName) {
              this.selectedThemeColor = styleObj.styleColor;
              break;
            }
          }
        }
        //if selectedThemeColor is not set then by default use black
        if (!this.selectedThemeColor) {
          this.selectedThemeColor = "#000000";
        }
        if (changeData) {
          this._itemListObject.selectedThemeColor = this.selectedThemeColor;
          this._itemListObject.resetIconColors();
        }
      }), lang.hitch(this, function () {
        this.selectedThemeColor = "#000000";
      }));
    },
    /**
    * This function is used to detect style change of WAB in editor mode.
    * Once it is detected, theme is reset.
    * For e.g. changing dashboard theme style from light to dark
    * -- memberOf EpaTracer/Widget
    */
    onAppConfigChanged: function (appConfig, reason, changedData) {
      var selectedThemeName;
      if (reason === "styleChange") {
        if (appConfig && appConfig.theme && appConfig.theme.customStyles &&
            appConfig.theme.customStyles.mainBackgroundColor) {
          this._itemListObject.selectedThemeColor = appConfig.theme.customStyles.mainBackgroundColor;
          this._itemListObject.resetIconColors();
        } else {
          selectedThemeName = appConfig.theme.name;
          this._getSelectedThemeColor(selectedThemeName, changedData);
        }
      }
    }
  });
});