///////////////////////////////////////////////////////////////////////////
// Copyright © Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////
define([
  "dojo/_base/declare",
  "jimu/BaseWidgetSetting",
  "dijit/_WidgetsInTemplateMixin",
  "dojo/_base/lang",
  "dojo/dom-construct",
  "dojo/query",
  "dojo/on",
  "dojo/sniff",
  "dojo/dom-style",
  "dijit/Editor",
  "./SymbolChooserPopup",
  "jimu/dijit/ColorPicker",
  "dojo/_base/Color",
  "jimu/utils",
  "esri/symbols/jsonUtils",
  "jimu/dijit/Message",
  "jimu/dijit/LoadingIndicator",
  "jimu/dijit/Popup",
  "./NetworkServiceChooser",
  "./layerChooserPopup",
  "./SearchSourceSettings",
  "./SymbologySettings",
  "./FilterSetting",
  "../utils",
  "jimu/portalUtils",
  'jimu/symbolUtils',
  "jimu/dijit/TabContainer3",
  'jimu/dijit/EditorXssFilter',
  "dojo/dom-class",
  "dojo/html",
  'dijit/_editor/plugins/LinkDialog',
  'dijit/_editor/plugins/ViewSource',
  'dijit/_editor/plugins/FontChoice',
  'dojox/editor/plugins/Preview',
  'dijit/_editor/plugins/TextColor',
  'dojox/editor/plugins/ToolbarLineBreak',
  'dojox/editor/plugins/FindReplace',
  'dojox/editor/plugins/PasteFromWord',
  'dojox/editor/plugins/InsertAnchor',
  'dojox/editor/plugins/Blockquote',
  'dojox/editor/plugins/UploadImage',
  'jimu/dijit/EditorChooseImage',
  'jimu/dijit/EditorTextColor',
  'jimu/dijit/EditorBackgroundColor',
  "jimu/dijit/CheckBox",
  "dojo/domReady!"
], function (
  declare,
  BaseWidgetSetting,
  _WidgetsInTemplateMixin,
  lang,
  domConstruct,
  query,
  on,
  has,
  domStyle,
  Editor,
  SymbolChooserPopup,
  ColorPicker,
  Color,
  utils,
  jsonUtils,
  Message,
  LoadingIndicator,
  Popup,
  NetworkServiceChooser,
  LayerChooserPopup,
  SearchSourceSettings,
  SymbologySettings,
  FilterSettings,
  appUtils,
  portalUtils,
  symbolUtils,
  TabContainer3,
  EditorXssFilter,
  domClass,
  html
) {
  return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
    baseClass: 'jimu-widget-epatracer-setting',
    _unitsDetails: {}, // To store unit format
    _searchLayers: [], // Selected search layers
    _loading: null, //loading indicator instance
    _appUtils: null, // Utils widget instance
    _symbolParams: {}, //to store symbol info
    _symbologySettingTab: null, // object of symbology setting tab

    startup: function () {
      this.inherited(arguments);
      //init all editors and its css
      this._initEditorPluginsCSS();
      this._noFeatureMessageEditor = this._initEditor(this.noResultMesageNode);
      this._introductionMessagetEditor = this._initEditor(this.editorDescription);
      //once all editors are created set the config.
      this.setConfigForEditor();
    },

    postMixInProperties: function () {
      //mixin default nls with widget nls
      this.nls.common = {};
      lang.mixin(this.nls.common, window.jimuNls.common);
      this.nls.searchSetting.enableProximitySearch = this.nls.searchSetting.enableProximitySearch ||
        "Enable proximity search";
      this.nls.searchSetting.enableProximitySearchHintText = this.nls.searchSetting.enableProximitySearchHintText ||
        "Hint: Enable ability to search for locations near a selected result";
    },

    postCreate: function () {
      this._unitsDetails = {}; // To store unit format
      this._searchLayers = []; // Selected search layers
      this._symbolParams = {}; //to store symbol info
      var defaultBufferSymbol = {
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
      var defaultPolygonSymbol = {
        "color": [
          255,
          189,
          1,
          0
        ],
        "outline": {
          "color": [
            255,
            189,
            1,
            255
          ],
          "width": 2.25,
          "type": "esriSLS",
          "style": "esriSLSSolid"
        },
        "type": "esriSFS",
        "style": "esriSFSSolid"
      };
      var defaultPolylineSymbol = {
        "color": [
          21,
          99,
          184,
          255
        ],
        "width": 3.75,
        "type": "esriSLS",
        "style": "esriSLSSolid"
      };
      //init loader
      this._initLoading();
      //initialize tabs
      this._initTabs();
      this.editorXssFilter = EditorXssFilter.getInstance();
      //create object to store standard unit format for buffer distance unit, direction length unit and distance unit
      this._unitsDetails = {
        "miles": {
          "bufferUnit": "UNIT_STATUTE_MILE",
          "routeUnit": "MILES",
          "distanceUnit": "miles",
          "label": this.nls.units.miles.displayText,
          "acronym": this.nls.units.miles.acronym,
          "value": "miles"
        },
        "kilometers": {
          "bufferUnit": "UNIT_KILOMETER",
          "routeUnit": "KILOMETERS",
          "distanceUnit": "kilometers",
          "label": this.nls.units.kilometers.displayText,
          "acronym": this.nls.units.kilometers.acronym,
          "value": "kilometers"
        },
        "meters": {
          "bufferUnit": "UNIT_METER",
          "routeUnit": "METER",
          "distanceUnit": "meters",
          "label": this.nls.units.meters.displayText,
          "acronym": this.nls.units.meters.acronym,
          "value": "meters"
        },
        "feet": {
          "bufferUnit": "UNIT_FOOT",
          "routeUnit": "FEET",
          "distanceUnit": "feet",
          "label": this.nls.units.feet.displayText,
          "acronym": this.nls.units.feet.acronym,
          "value": "feet"
        }
      };
      //set invalid message attribute for max result count input node
      this.maxResultCountNode.set("invalidMessage",
        this.nls.errorStrings.invalidMaximumResultCountValue);
      //set min value for default buffer

      this.defaultBufferDistanceNode.set("constraint", { "min": 0 });
      //set invalid message attribute for default buffer distance input node
      this.defaultBufferDistanceNode.set("invalidMessage", this.nls.errorStrings.bufferErrorString);
      //set min value for max buffer
      this.maxBufferDistanceNode.set("constraint", { "min": 1 });
      //set invalid message attribute for maximum buffer distance input node
      this.maxBufferDistanceNode.set("invalidMessage", this.nls.errorStrings.bufferErrorString);
      
      this.defaultUpstreamDistanceNode.set("constraint", { "min": 0.5 });
      //set invalid message attribute for default buffer distance input node
      this.defaultUpstreamDistanceNode.set("invalidMessage", this.nls.errorStrings.upstreamDistanceErrorString);
      //set min value for max buffer
      this.maxUpstreamDistanceNode.set("constraint", { "min": 1 });
      //set invalid message attribute for maximum buffer distance input node
      this.maxUpstreamDistanceNode.set("invalidMessage", this.nls.errorStrings.upstreamDistanceErrorString);

      //initialize utils widget
      this._appUtils = new appUtils({ map: this.map });
      //attach 'click' event on add layer button to display popup to select search layers
      this.own(on(this.addLayerButton, 'click', lang.hitch(this, this._showLayerChooserPopup)));

      //handle cick event on check box to show hide direction settings
      this.own(on(this.enableDirectionCheckBoxNode, 'change',
        lang.hitch(this, this._onEnableDirectionChange)));

      //For supporting backward compatibility
      //If enableDirection key is not available in config
      //then enable direction based on webmap routing property
      if (!this.config.hasOwnProperty("enableDirection")) {
        //Check if routing is available and enabled in webmap then use it else set it to false
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
       //based on directions are enabled or not show hide direstion settings
       if (this.config.enableDirection) {
        domClass.remove(this.routeSettingsNode, "esriCTHidden");
      } else {
        domClass.add(this.routeSettingsNode, "esriCTHidden");
      }

      //set previous/default symbol values
      this._createSymbolPicker(this.routeSymbolNode, "routeSymbol",
        "esriGeometryPolyline", this.nls.routeSetting.selectRouteSymbol);
      this._createSymbolPicker(this.pointSymbolNode, "graphicLocationSymbol",
        "esriGeometryPoint", this.nls.searchSetting.selectGraphicLocationSymbol);
      //as bufferSymbol was not configurable in prev versions add it's default value
      if (this.config && this.config.symbols &&
        !this.config.symbols.hasOwnProperty("polylineSymbol")) {
        this.config.symbols.polylineSymbol = defaultPolylineSymbol;
        //hide the symbol chooser as it was not configurable in prev versions
        domClass.add(this.bufferColorSetting, "esriCTHidden");
      }
      this._createSymbolPicker(this.polylineSymbolNode, "polylineSymbol",
        "esriGeometryPolyline", this.nls.searchSetting.popupTitleForPolyline);
      //as bufferSymbol was not configurable in prev versions add it's default value
      if (this.config && this.config.symbols &&
        !this.config.symbols.hasOwnProperty("polygonSymbol")) {
        this.config.symbols.polygonSymbol = defaultPolygonSymbol;
        //hide the symbol chooser as it was not configurable in prev versions
        domClass.add(this.bufferColorSetting, "esriCTHidden");
      }
      this._createSymbolPicker(this.addressLocationPolygonSymbolNode, "polygonSymbol",
        "esriGeometryPolygon", this.nls.searchSetting.popupTitleForPolygon);
      //as bufferSymbol was not configurable in prev versions add it's default value
      if (this.config && this.config.symbols &&
        !this.config.symbols.hasOwnProperty("bufferSymbol")) {
        this.config.symbols.bufferSymbol = defaultBufferSymbol;
        //hide the symbol chooser as it was not configurable in prev versions
        domClass.add(this.bufferColorSetting, "esriCTHidden");
      }
      this._createSymbolPicker(this.polygonSymbolNode, "bufferSymbol",
        "esriGeometryPolygon", this.nls.searchSetting.bufferColorLabel);
      // attach 'click' event on 'set' button to set the route URL
      this.own(on(this.onSetBtnClickNode, 'click', lang.hitch(this, this._showRouteChooser)));
      //create color picker
      this._createColorPicker();
      //highlight color picker
      this._createHighlightColorPicker();
      //display configuration setting options in UI panel
      this.setConfig();

      // bind 'click' event on bufferVisibilityCheckBox for show/hide the buffer color setting section
      if (this.bufferVisibilityCheckBox.checkNode) {
        this.own(on(this.bufferVisibilityCheckBox, 'change', lang.hitch(this, this
          ._onVisibilityChange)));
      }

      //handle cick event on check box to show hide highlight color picker
      this.own(on(this.highlightColorCheckBoxNode, 'change',
        lang.hitch(this, this._onHighlightColorChange)));
        
      //create search source settings tab content
      this._createSearchSourceSettings();
      this._initSymbologySetting();
      this._initFilterSetting();
    },

    /**
     * This function used to show hide highlight color picker
     * @memberOf widgets/EpaTracer/setting/Setting
     **/
    _onHighlightColorChange: function () {
      if (this.highlightColorCheckBoxNode.getValue() == true) {
        domClass.remove(this.highlightColorPickerParentNode, "esriCTHidden");
      } else {
        domClass.add(this.highlightColorPickerParentNode, "esriCTHidden");
      }
    },

    /**
    * This function the initializes jimu tab for setting and layout
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _initTabs: function () {
      var layerSettingTab, routeSettingTab, searchSourceSettingTab, symbologySettingTab, filterSettingTab, tabs;
      searchSourceSettingTab = {
        title: this.nls.searchSourceSetting.searchSourceSettingTabTitle,
        content: this.searchSourceTabNode
      };
      layerSettingTab = {
        title: this.nls.searchSetting.searchSettingTabTitle,
        content: this.searchTabNode
      };
      routeSettingTab = {
        title: this.nls.routeSetting.routeSettingTabTitle,
        content: this.directionTabNode
      };
      symbologySettingTab = {
        title: this.nls.symbologySetting.symbologySettingTabTitle,
        content: this.symbologyTabNode
      };
      filterSettingTab = {
        title: this.nls.filterSetting.filterSettingTabTitle,
        content: this.filterTabNode
      };
      tabs = [searchSourceSettingTab, layerSettingTab, routeSettingTab, symbologySettingTab, filterSettingTab];

      this.tab = new TabContainer3({
        "tabs": tabs,
        "class": "esriCTFullHeight"
      });
      // Handle tabChanged event and set the scroll position to top
      this.own(on(this.tab, "tabChanged", lang.hitch(this, function () {
        this.tab.containerNode.scrollTop = 0;
      })));
      this.tab.placeAt(this.tabDiv);
    },

    /**
   * This function is used to enable direction of config
   * @memberOf widgets/EpaTracer/setting/Setting
   **/
    _onEnableDirectionChange: function () {
      if (this.enableDirectionCheckBoxNode.getValue()) {
        domClass.remove(this.routeSettingsNode, "esriCTHidden");
      } else {
        domClass.add(this.routeSettingsNode, "esriCTHidden");
      }
    },


    /**
     * This function is used to initialize filter settings
     * @memberOf widgets/EpaTracer/setting/Setting
     */
    _initFilterSetting: function () {
      this._filterSettingTab = new FilterSettings({
        nls: this.nls,
        map: this.map,
        config: this.config,
        folderUrl: this.folderUrl
      });
      this._filterSettingTab.placeAt(this.filterTabNode);
    },

    /**
     * This function is used to initialize costing info
     * @memberOf widgets/EpaTracer/setting/Setting
     */
    _initSymbologySetting: function () {
      this._symbologySettingTab = new SymbologySettings({
        nls: this.nls,
        map: this.map,
        config: this.config
      });
      this._symbologySettingTab.placeAt(this.symbologyTabNode);
    },

    /**
    * This function the initializes search source setting tab container
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _createSearchSourceSettings: function () {
      var searchSourceConfig = {};
      //if has valid sources set that as prev config
      if (this.config && this.config.hasOwnProperty('searchSourceSettings')) {
        searchSourceConfig = this.config.searchSourceSettings;
      }
      this._searchSourceSettings = new SearchSourceSettings({
        nls: this.nls,
        map: this.map,
        appConfig: this.appConfig,
        shelter: this._loading,
        config: searchSourceConfig
      }, domConstruct.create("div", {}, this.searchSourceTabNode));
      this.own(on(this._searchSourceSettings, "invalid-source-setting",
        lang.hitch(this, function () {
          this._errorMessage(this.nls.errorStrings.invalidSearchSources);
        })));
    },


    /**
    * This function gets and create config data in config file.
    * @return {object} Object of config
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    getConfig: function () {
      var searchSources, maxResultCount, attributeSymbology, filterSettings;
      //validate configured values
      if (!(this._searchLayers && this._searchLayers.length)) {
        this._errorMessage(this.nls.errorStrings.selectLayerErrorString,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      // maximum slider value should not be less than equal to 0 as minimum value is 0
      if (Number(this.maxBufferDistanceNode.value) <= 0) {
        this._errorMessage(this.nls.errorStrings.maximumBufferValueGreaterThanOne,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      // maximum slider value should not be empty or non negative number
      if (lang.trim(this.maxBufferDistanceNode.displayedValue) === "") {
        this._errorMessage(this.nls.errorStrings.invalidMaximumValue,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      } else if (!this.maxBufferDistanceNode.value) {
        this._errorMessage(this.nls.errorStrings.bufferErrorString,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      // Buffer slider default value should not be greater than maximum value
      if (Number(this.defaultBufferDistanceNode.value) > Number(this.maxBufferDistanceNode.value)) {
        this._errorMessage(this.nls.errorStrings.defaultValueLessThanMax,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      // default slider value should not be less than 1
      if (Number(this.defaultBufferDistanceNode.value) < 0) {
        this._errorMessage(this.nls.errorStrings.defaultBufferValueGreaterThanOne,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      // default slider value for non negative number
      if (lang.trim(this.defaultBufferDistanceNode.displayedValue) === "") {
        this._errorMessage(this.nls.errorStrings.invalidDefaultValue,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      } else if (!this.defaultBufferDistanceNode.isValid()) {
        this._errorMessage(this.nls.errorStrings.bufferErrorString,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      //check for validations on maximum result count value
      if (lang.trim(this.maxResultCountNode.displayedValue) !== "" &&
        (isNaN(this.maxResultCountNode.value) ||
          this.maxResultCountNode.value !== parseInt(this.maxResultCountNode.value, 10) ||
          this.maxResultCountNode.value < 1)) {
        this._errorMessage(this.nls.errorStrings.invalidMaximumResultCountValue,
          this.nls.searchSetting.searchSettingTabTitle);
        return false;
      }
      //if max result count is NAN set it to null to avoid breaking of config check in WAB
      maxResultCount = this.maxResultCountNode.value;
      if (isNaN(maxResultCount)) {
        maxResultCount = null;
      }
      //get configured symbology
      attributeSymbology = this._symbologySettingTab.getConfig();
      if (!attributeSymbology.isValid) {
        this._errorMessage(attributeSymbology.message,
          this.nls.symbologySetting.symbologySettingTabTitle);
        return false;
      } else {
        attributeSymbology = attributeSymbology.symbolConfig;
      }
      //get configured filters
      filterSettings = this._filterSettingTab.getConfig();
      if (!filterSettings) {
        //Select the tab if exist as error is occuerd in filter settings
        if (this.tab) {
          this.tab.selectTab(this.nls.filterSetting.filterSettingTabTitle);
        }
        return false;
      }
      //get configured search sources
      searchSources = this._searchSourceSettings.getConfig();
      //check if valid sources are configured
      if (!searchSources || searchSources.sources.length === 0) {
        this._errorMessage(this.nls.errorStrings.invalidSearchSources,
          this.nls.searchSourceSetting.searchSourceSettingTabTitle);
        return false;
      }
      //set config with current configured options
      this.config = {
        "fontColor": this._fontColorPicker.color.toHex(),
        "highlightColor": this._highlightColorPicker.color.toHex(),
        "showSelectionColor": this.highlightColorCheckBoxNode.getValue(),
        "searchLayers": this._searchLayers,
        "bufferInfo": this._getBufferInfo(),
        "defaultBufferDistance": Math.round(this.defaultBufferDistanceNode.value),
        "maxBufferDistance": Math.round(this.maxBufferDistanceNode.value),
        "bufferDistanceUnit": this._unitsDetails[this.selectBufferUnitNode.value],
        
        "defaultUpstreamDistance": Math.round(this.defaultUpstreamDistanceNode.value),
        "maxUpstreamDistance": Math.round(this.maxUpstreamDistanceNode.value),
        "upstreamDistanceUnit": this._unitsDetails[this.selectUpstreamDistanceUnitNode.value],
        "zoomToFeature": this.zoomToSelectedFeature.getValue(),
        "intersectSearchedLocation": this.intersectSearchLocation.getValue(),
        "enableProximitySearch": this.enableProximitySearch.getValue(),
        "routeService": this.routeServiceURLNode.value,
        "directionLengthUnit": this._unitsDetails[this.directionLengthUnitNode.value],
        "selectedSearchLayerOnly": this.searchLayerResultNode.getValue(),
        "isGeodesic": this.geoDesicCheckBoxNode.getValue(),
        "showLocationTool": this.setLocationCheckBoxNode.getValue(),
        "symbols": this._symbolParams,
        "maxResultCount": maxResultCount,
        "searchSourceSettings": searchSources,
        "attributeSymbology": attributeSymbology,
        "filterSettings": filterSettings,
        "showImageGallery": this.showImageGalleryNode.getValue(),
        "showFeaturesCount": this.showResultCountNode.getValue(),
        "editorDescription": this._getText(this._introductionMessagetEditor),
        "noFeatureFoundMessage": this._getText(this._noFeatureMessageEditor),
        "showCurrentLocationTool": this.setCurrentLocationCheckBoxNode.getValue(),
        "enableDirection":  this.enableDirectionCheckBoxNode.getValue()
      };
      if(this.bufferDistanceSliderRBNode.get("checked")){
        this.config.bufferInputOption = "slider"
      }
      if(this.bufferDistanceTextboxRBNode.get("checked")){
        this.config.bufferInputOption = "textbox"
      }
      if(this.bufferDistanceSliderandTextboxRBNode.get("checked")){
        this.config.bufferInputOption = "sliderAndTextbox"
      }
      return this.config;
    },

    /**
    * get buffer info- color,opacity and visibility
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _getBufferInfo: function () {
      var bufferInfo = {};
      bufferInfo = {
        "isVisible": this.bufferVisibilityCheckBox.getValue()
      };
      return bufferInfo;
    },

    /**
    * This function set and update the config data in config file.
    * @return {object} Object of config
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    setConfig: function () {
      var helperServices = portalUtils.getPortal(this.appConfig.portalUrl)
        .helperServices;
      if (this.config) {
        //set configured color selected in color picker node
        if (this.config.fontColor) {
          this._fontColorPicker.setColor(new Color(this.config.fontColor));
        }
        //set configured hoghlight color selected in color picker node
        if (this.config.highlightColor) {
          this._highlightColorPicker.setColor(new Color(this.config.highlightColor));
        } else { 
          this._highlightColorPicker.setColor(new Color("#00FFFF"));
        }

        //for backwardcmpatibility if showSelectionColor is not found in config add it
        if (!this.config.hasOwnProperty('showSelectionColor')) {
          this.config.showSelectionColor = true;
        }
        // check if user wants highlight color
        this.highlightColorCheckBoxNode.setValue(this.config.showSelectionColor);
        this._onHighlightColorChange();
        if (this.config.searchLayers) {
          //set search layers in config UI
          this._setSearchLayersInfo(this.config.searchLayers);
        }
        if (this.config.bufferInfo) {
          //set configured color selected in color picker node for buffer
          this._setBufferInfo(this.config.bufferInfo);
        }
        if (this.config.maxResultCount) {
          //set maximum result count value
          this.maxResultCountNode.set("value", this.config.maxResultCount);
        }
        if (this.config.defaultBufferDistance || this.config.defaultBufferDistance === 0) {
          //set default buffer distance value
          this.defaultBufferDistanceNode.set("value", this.config.defaultBufferDistance);
        }
        if (this.config.maxBufferDistance || this.config.maxBufferDistance === 0) {
          //set maximum distance value
          this.maxBufferDistanceNode.set("value", this.config.maxBufferDistance);
        }
        if (this.config.bufferDistanceUnit) {
          //set buffer distance unit
          this.selectBufferUnitNode.set("value", this.config.bufferDistanceUnit.value);
        }
        
        if (this.config.defaultUpstreamDistance || this.config.defaultUpstreamDistance === 0) {
          //set default buffer distance value
          this.defaultUpstreamDistanceNode.set("value", this.config.defaultUpstreamDistance);
        }
        if (this.config.maxUpstreamDistance || this.config.maxUpstreamDistance === 0) {
          //set maximum distance value
          this.maxUpstreamDistanceNode.set("value", this.config.maxUpstreamDistance);
        }
        if (this.config.upstreamDistanceUnit) {
          //set buffer distance unit
          this.selectUpstreamDistanceUnitNode.set("value", this.config.upstreamDistanceUnit.value);
        }               
        
        if (this.config.directionLengthUnit) {
          //set direction length unit
          this.directionLengthUnitNode.set("value", this.config.directionLengthUnit.value);
        }
        if (this.config.selectedSearchLayerOnly) {
          this.searchLayerResultNode.setValue(this.config.selectedSearchLayerOnly);
        }

        //set the route service url if previously configured
        //else if set it to organizations routing service
        //else set it to AGOL world routing service
        if (this.config.routeService) {
          this.routeServiceURLNode.set("value", this.config.routeService);
        } else if (helperServices && helperServices.route &&
          helperServices.route.url) {
          this.routeServiceURLNode.set("value", helperServices.route.url);
        } else {
          this.routeServiceURLNode.set("value", window.location.protocol +
            "//route.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World"
          );
        }

        // Enables the Zoom to selected feature, if it was enabled earlier
        if (this.config.zoomToFeature) {
          this.zoomToSelectedFeature.setValue(this.config.zoomToFeature);
        }

        // Enables the intersect searched location, if it was enabled earlier
        if (this.config.intersectSearchedLocation) {
          this.intersectSearchLocation.setValue(this.config.intersectSearchedLocation);
        }

        // Enables the option to do a proximity search from a selected value, if it was enabled earlier
        if (this.config.enableProximitySearch === undefined) {
          this.config.enableProximitySearch = true;
        }
        if (this.config.enableProximitySearch) {
          this.enableProximitySearch.setValue(this.config.enableProximitySearch);
        }

        // check if user wants select location on
        if (this.config.showLocationTool) {
          this.setLocationCheckBoxNode.setValue(this.config.showLocationTool);
        }

        // check if user wants geodesic parameters
        if (this.config.isGeodesic) {
          this.geoDesicCheckBoxNode.setValue(this.config.isGeodesic);
        }

        //for backwardcmpatibility if showImageGallery is not found in config add it
        if(!this.config.hasOwnProperty('showImageGallery')) {
          this.config.showImageGallery = true;
        }
        // check if user wants select location on
        if (this.config.showImageGallery) {
          this.showImageGalleryNode.setValue(this.config.showImageGallery);
        }

        //for backwardcmpatibility if showFeaturesCount is not found in config add it
        if (!this.config.hasOwnProperty('showFeaturesCount')) {
          this.config.showFeaturesCount = true;
        }
        // check if user wants see feature count
        if (this.config.showFeaturesCount) {
          this.showResultCountNode.setValue(this.config.showFeaturesCount);
        }

        // check if user wants select location on
        if (this.config.showCurrentLocationTool) {
          this.setCurrentLocationCheckBoxNode.setValue(this.config.showCurrentLocationTool);
        }
        //set the enable direction checkbox
        this.enableDirectionCheckBoxNode.setValue(this.config.enableDirection); 
        //for backwardcmpatibility if bufferInputOption is not found in config add it and set to slider only
        if (!this.config.hasOwnProperty('bufferInputOption')) {
          this.config.bufferInputOption = "slider";
        }
        // set buffer input option radio button
        if (this.config.bufferInputOption === "slider") {
          this.bufferDistanceSliderRBNode.set("checked", true);
        } else if(this.config.bufferInputOption === "textbox"){
          this.bufferDistanceTextboxRBNode.set("checked", true);
        } else if(this.config.bufferInputOption === "sliderAndTextbox"){
          this.bufferDistanceSliderandTextboxRBNode.set("checked", true);
        }
      }
    },
    
    setConfigForEditor: function () {
      //set configured no feature found message or else defalut msg
      if (this.config.noFeatureFoundMessage) {
        this._noFeatureMessageEditor.set("value",
          this.editorXssFilter.sanitize(this.config.noFeatureFoundMessage));
      } else {
        this._noFeatureMessageEditor.set("value",
          this.editorXssFilter.sanitize(this.nls.searchSetting.noFeatureFoundText));
      }
      //set configured text for search heading/ introduction of widget or else set a defalut msg
      if (!this.config.editorDescription) {
        this._introductionMessagetEditor.set("value",
          this.editorXssFilter.sanitize(this.nls.searchSetting.searchHeaderText));
      }
      else {
        this._introductionMessagetEditor.set("value",
          this.editorXssFilter.sanitize(this.config.editorDescription));
      }
    },

    _getText: function (editorObj) {
      var editorText;
      editorText = editorObj.focusNode.innerHTML;
      return editorText;
    },

    _initEditor: function (containerNode) {
        var editorObj = new Editor({
          plugins: [
            'bold', 'italic', 'underline',
            utils.getEditorTextColor("smartEditor"), utils.getEditorBackgroundColor("smartEditor"),
            '|', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
            '|', 'insertOrderedList', 'insertUnorderedList', 'indent', 'outdent'
          ],
          extraPlugins: [
            '|', 'createLink', 'unlink', 'pastefromword', '|', 'undo', 'redo',
            '|', 'toolbarlinebreak',//'chooseImage', 'uploadImage',
            {
              name: "dijit._editor.plugins.FontChoice",
              command: "fontName",
              custom: "Arial;Comic Sans MS;Courier New;Garamond;Tahoma;Times New Roman;Verdana".split(";")
            }, 'fontSize', 'formatBlock'
          ],
          style: "font-family:Verdana;"
        }, containerNode);
        domStyle.set(editorObj.domNode, {
          "width": '100%',
          "height": '100%'
        });
        editorObj.startup();
        if (has('ie') !== 8) {
          editorObj.resize({
            w: '100%',
            h: '100%'
          });
        } else {
          var box = html.getMarginBox(containerNode);
          editorObj.resize({
            w: box.w,
            h: box.h
          });
        }
      return editorObj;
    },
    /**
    * this function loads the editor tool plugins CSS
    **/
    _initEditorPluginsCSS: function () {
      var head, tcCssHref, tcCss, epCssHref, epCss, pfCssHref, pfCss;
      head = document.getElementsByTagName('head')[0];
      tcCssHref = window.apiUrl + "dojox/editor/plugins/resources/css/TextColor.css";
      tcCss = query('link[href="' + tcCssHref + '"]', head)[0];
      if (!tcCss) {
        utils.loadStyleLink("editor_plugins_resources_TextColor", tcCssHref);
      }
      epCssHref = window.apiUrl + "dojox/editor/plugins/resources/editorPlugins.css";
      epCss = query('link[href="' + epCssHref + '"]', head)[0];
      if (!epCss) {
        utils.loadStyleLink("editor_plugins_resources_editorPlugins", epCssHref);
      }
      pfCssHref = window.apiUrl + "dojox/editor/plugins/resources/css/PasteFromWord.css";
      pfCss = query('link[href="' + pfCssHref + '"]', head)[0];
      if (!pfCss) {
        utils.loadStyleLink("editor_plugins_resources_PasteFromWord", pfCssHref);
      }
    },

    /**
    * This function creates symbols in config UI
    * @param {object} symbolNode: contains a symbol chooser node
    * @param {string} symbolType: contains symbol type
    * @param {string} geometryType: contains symbol geometry type
    * @param {string} symbolChooserTitle: contains a symbol chooser popup title
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _createSymbolPicker: function (symbolNode, symbolType, geometryType, symbolChooserTitle) {
      var objSymbol, symbolChooserNode, params;
      //if symbol geometry exist
      if (geometryType) {
        objSymbol = {};
        objSymbol.type = utils.getSymbolTypeByGeometryType(geometryType);
        // if symbols parameter available in input parameters then take symbol details
        if (this.config && this.config.symbols) {
          // check whether symbolType info is available in config
          if (this.config.symbols.hasOwnProperty(symbolType)) {
            // fetch selected symbol from config
            objSymbol.symbol = jsonUtils.fromJson(this.config.symbols[symbolType]);
          }
        }
        symbolChooserNode = this._createPreviewContainer(symbolNode);
        //create params to initialize 'symbolchooserPopup' widget
        params = {
          symbolChooserTitle: symbolChooserTitle,
          symbolParams: objSymbol,
          nls: this.nls,
          symbolType: symbolType
        };
        //display configured symbol in symbol chooser node
        this._showSelectedSymbol(symbolChooserNode, objSymbol.symbol, symbolType);
        //attach 'click' event on node to display symbol chooser popup
        this.own(on(symbolChooserNode, 'click', lang.hitch(this, function () {
          //set recently selected symbol in symbol chooser popup
          objSymbol.symbol = jsonUtils.fromJson(this._symbolParams[symbolType]);
          this._initSymbolChooserPopup(params, symbolChooserNode);
        })));
      }
    },

    /**
    * Create preview container to display selected symbol
    * @param {object} symbolNode: contains node to display selected graphic symbol
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _createPreviewContainer: function (symbolNode) {
      var tablePreviwText, trPreviewText, tdPreviewText, tdSymbolNode,
        divPreviewText, symbolChooserNode;
      tablePreviwText = domConstruct.create("table", {
        "cellspacing": "0",
        "cellpadding": "0"
      }, symbolNode);
      trPreviewText = domConstruct.create("tr", { "style": "height:30px" }, tablePreviwText);
      tdPreviewText = domConstruct.create("td", {}, trPreviewText);
      divPreviewText = domConstruct.create("div", {
        "innerHTML": this.nls.symbolPickerPreviewText,
        "class": "esriCTSymbolPreviewText"
      }, tdPreviewText);
      tdSymbolNode = domConstruct.create("td", {}, trPreviewText);
      //create content div for symbol chooser node
      symbolChooserNode = domConstruct.create("div", {
        "class": "esriCTSymbolChooserNode"
      }, tdSymbolNode);
      return symbolChooserNode;
    },

    /**
    * Initialize symbol chooser popup widget
    * @param {object} params: contains params to initialize widget
    * @param {object} symbolChooserNode: contains node to display selected graphic symbol
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _initSymbolChooserPopup: function (params, symbolChooserNode) {
      var symbolChooserObj = new SymbolChooserPopup(params);
      //handler for poopup 'OK' button 'click' event
      symbolChooserObj.onOkClick = lang.hitch(this, function () {
        //get selected symbol
        var symbolJson = symbolChooserObj.symbolChooser.getSymbol();
        this._showSelectedSymbol(symbolChooserNode, symbolJson, params.symbolType);
        symbolChooserObj.popup.close();
      });
    },

    /**
    * show selected graphic symbol in symbol chooser node
    * @param {object} symbolChooserNode: contains a symbol chooser node
    * @param {object} symbolJson: contains a json structure for symbol
    * @param {string} symbolType: contains symbol type
    * @member of widgets/EpaTracer/setting/Setting
    **/
    _showSelectedSymbol: function (symbolChooserNode, symbolJson, symbolType) {
      domConstruct.empty(symbolChooserNode);
      if (symbolJson) {
        var symbolNode = symbolUtils.createSymbolNode(symbolJson);
        // if symbol node is not created
        if (!symbolNode) {
          symbolNode = domConstruct.create('div');
        }
        domConstruct.place(symbolNode, symbolChooserNode);
        //store selected symbol in 'symbolParams' object
        this._symbolParams[symbolType] = symbolJson.toJson();
      }
    },

    /**
    * This function creates color picker instance to select font color and buffer color
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _createColorPicker: function () {
      //color picker for font
      this._fontColorPicker = new ColorPicker(null, domConstruct.create("div", {},
        this.colorPickerNode));
    },

    /**
    * This function creates color picker instance to show selected highlight color in widget
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
   _createHighlightColorPicker: function () {
    //color picker for font
    this._highlightColorPicker = new ColorPicker(null, domConstruct.create("div", {},
      this.highlightColorPickerNode));
  },

    /**
    * This function create error alert.
    * @param {string} err - Error message to be shown
    * @param {string} selectTab - Tab name to be selected
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _errorMessage: function (err, selectTab) {
      var errorMessage = new Message({
        message: err
      });
      errorMessage.message = err;
      //Select the tab if exist
      if (this.tab && selectTab) {
        this.tab.selectTab(selectTab);
      }
    },

    /**
    * This function used for loading indicator
    * @memberOf widgets/EpaTracer/setting/Setting
    */
    _initLoading: function () {
      var popupContainer;
      this._loading = new LoadingIndicator({
        hidden: true
      });
      popupContainer = query(".widget-setting-popup")[0];
      this._loading.placeAt(popupContainer);
      this._loading.startup();
    },

    /**
    * Set the routing URL.
    * @memberOf widgets/EpaTracer/setting/Setting
    */
    _showRouteChooser: function () {
      var param, networkServiceChooserObj, popup;
      //create parameter object for network analysis chooser
      param = {
        "portalUrl": this.appConfig.portalUrl,
        "nls": this.nls,
        "folderUrl": this.folderUrl
      };
      //initialize network analysis chooser widget
      networkServiceChooserObj = new NetworkServiceChooser(param);
      popup = new Popup({
        titleLabel: this.nls.routeSetting.routeServiceUrl,
        width: 830,
        height: 600,
        content: networkServiceChooserObj
      });
      //display selected route URL in config setting panel on click of 'OK' button
      networkServiceChooserObj.onOkClick = lang.hitch(this, function () {
        //check whether route URL is selected or not
        if (networkServiceChooserObj.selectRouteURL) {
          this.routeServiceURLNode.set('value', networkServiceChooserObj.selectRouteURL);
          popup.close();
        }
      });
      //hide network analysis chooser popup on click of 'cancel' button
      networkServiceChooserObj.onCancelClick = lang.hitch(this, function () {
        popup.close();
      });
    },

    /**
    * show layer selector popup.
    * @memberOf widgets/EpaTracer/setting/Setting
    */
    _showLayerChooserPopup: function () {
      var layerChooserPopup, param;
      param = {
        map: this.map,
        nls: this.nls,
        configuredSearchLayer: this._searchLayers && this._searchLayers.length > 0 ?
          this._searchLayers : this.config.searchLayers
      };
      // initialize layer chooser popup widget
      layerChooserPopup = new LayerChooserPopup(param);
      layerChooserPopup.startup();
      //hide layer chooser popup and display selected layers in config UI panel
      layerChooserPopup.onOkClick = lang.hitch(this, function () {
        this._setSearchLayersInfo(layerChooserPopup.searchLayers);
        layerChooserPopup.popup.close();
        if (this._symbologySettingTab) {
          this._symbologySettingTab.updateLayerOptions(layerChooserPopup.searchLayers);
        }
        if (this._filterSettingTab) {
          this._filterSettingTab.updateLayerOptions(layerChooserPopup.searchLayers);
        }
      });
    },

    /**
    * fetch updated layer data from the webmap
    * @memberOf widgets/EpaTracer/setting/Setting
    */
    _setSearchLayersInfo: function (searchLayers) {
      for (var i = 0; i < searchLayers.length; i++) {
        lang.mixin(searchLayers[i], this._appUtils.getLayerDetailsFromMap(
          searchLayers[i].baseURL, searchLayers[i].layerId, searchLayers[i].id));
      }
      this._setSearchLayers(searchLayers);
    },

    /**
    * display selected layers in setting UI
    * @memberOf widgets/EpaTracer/setting/Setting
    */
    _setSearchLayers: function (searchLayers) {
      var i, divLayerList, imgPath, divGeometryIcon, geomType;
      this._searchLayers = searchLayers;
      domConstruct.empty(this.layerListNode);
      for (i = 0; i < searchLayers.length; i++) {
        if (searchLayers[i].geometryType) {
          //set geometry icon for layer
          geomType = utils.getTypeByGeometryType(searchLayers[i].geometryType);
          if (geomType === "point") {
            imgPath = "point_layer.png";
          } else if (geomType === "polygon") {
            imgPath = "polygon_layer.png";
          } else if (geomType === "polyline") {
            imgPath = "line_layer.png";
          }
          divLayerList = domConstruct.create("div", {
            "class": "esriCTLayerList"
          }, this.layerListNode);
          if (imgPath) {
            divGeometryIcon = domConstruct.create("div", {
              "class": "esriCTGeometryTypeIcon",
              "style": {
                "backgroundImage": "url(" + this.folderUrl + "images/" + imgPath + ")"
              }
            }, divLayerList);
          }
          //create div to display layer title
          domConstruct.create("div", {
            "class": "esriCTLayerListItem",
            "innerHTML": searchLayers[i].title,
            "title": searchLayers[i].title
          }, divLayerList);
        }
      }
    },

    /**
    * set configured buffer info
    * @param {object} bufferInfo
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _setBufferInfo: function (bufferInfo) {
      if (bufferInfo) {
        //set buffer visibility as configured
        this.bufferVisibilityCheckBox.setValue(bufferInfo.isVisible);
      }
      this._onVisibilityChange();
    },

    /**
    * show/hide buffer color setting section
    * @memberOf widgets/EpaTracer/setting/Setting
    **/
    _onVisibilityChange: function () {
      //display color picker if buffer visibility is set to true
      if (this.bufferVisibilityCheckBox.getValue()) {
        domClass.remove(this.bufferColorSetting, "esriCTHidden");
      } else {
        domClass.add(this.bufferColorSetting, "esriCTHidden");
      }
    }
  });
});