/*global define*/
define({
  root: ({
    _widgetLabel: "EPA Tracer", // widget label shown on the choose widget dialog and widget panel title
    searchHeaderText: "Click on map or search by measuring location ID", // Shown as a label in widget panel for search an address.
    invalidSearchLayerMsg: "Search layers are not configured properly", // Shown as a message when the configured search layer is invalid or no layer is configured
    bufferSliderText: "Show results within ${BufferDistance} ${BufferUnit}", // Shown as a label for slider to display the result in buffer area.
    bufferTextboxLabel: "Show results within (${BufferUnit})", // Shown as a label for slider to display the result in buffer area.
    invalidBufferDistance: "Entered buffer distance value is not valid.", //Shown as a error message when invalid value is entered in buffer textbox
    bufferSliderValueString: "Please specify a distance greater than 0", // Shown as a error when Buffer slider is set to zero distance in alert box.
    unableToCreateBuffer: "Result(s) could not be found", //display error message if buffer gets failed to generate
    selectLocationToolTip: "Set location", //Shown as tooltip when select location button is clicked
    noFeatureFoundText: "No results found ", //Shown as message if no features available in current buffer area
    unableToFetchResults: "Unable to fetch results from layer(s):", //shown as message if any layer is failed to fetch the results
    informationTabTitle: "Information", //Shown as title for information tab
    directionTabTitle: "Directions", //Shown as title for direction tab
    failedToGenerateRouteMsg: "Failed to generate route.", //Shown as a message when fail to generate route
    geometryServicesNotFound: "Geometry service not available.", //Shown as a message when fail to get geometry service
    allPopupsDisabledMsg: "Popups are not configured, results cannot be displayed.", //Shown as a message when popups for all the layers are disabled
    worldGeocoderName: "Address", //Esri World Geocoder title
    searchLocationTitle: "Searched Location", //Shown as a label on popup
    unknownAttachmentExt: "FILE", // Displayed for file attachments having unknown extension
    proximityButtonTooltip: "Search for diversions", //shown as tooltip for proximity button
    approximateDistanceTitle: "Approximate Distance: ${DistanceToLocation}", //Shown as text for distance
    toggleTip: "Click to show/hide filter settings", //Shown as tooltip to show/hide filter settings
    filterTitle: "Select filters to apply", //Shown as title on filters page
    downloadItemsTitle: "Download diversions",
    clearFilterButton: "Clear all filters", //Shown as a tooltip to clear all filter button
    bufferDistanceLabel: "Buffer Distance", // Shown as a label to horizontal slider
    upstreamDistanceLabel: "Upstream Distance", // Shown as a label to horizontal slider
    upstreamDistanceTextboxLabel: "Search upstream (${UpstreamUnit})",
    upstreamDistanceNoStreamsFoundMsg: "No streams were found within ${BufferDistance} ${BufferUnit} of selected location",
    invalidUpstreamDistance: "Entered upstream-search distance value is not valid. Setting value to minimum", //Shown as a error message when invalid value is entered in upstream-search distance textbox
    epaTracingUnnavigableStreamMsg: "Diversions will not be identified because this stream cannot be traced upstream",
    epaTracerErrorMsg: "Error locating or tracing nearby stream.  Check your input.  If you continue to have problems, use the contact-information provided.",
    informationContentLabel: "Information Content", // Set as a aria-label for info content pane
    units: { // label shown as label for slider text(slider unit) and acronym in feature list
      miles: {
        displayText: "Miles",
        acronym: "mi"
      },
      kilometers: {
        displayText: "Kilometers",
        acronym: "km"
      },
      feet: {
        displayText: "Feet",
        acronym: "ft"
      },
      meters: {
        displayText: "Meters",
        acronym: "m"
      }
    }
  })
});
