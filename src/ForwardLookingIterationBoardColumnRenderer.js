var ForwardLookingIterationBoardColumnRenderer = function(board, value, options) {
          rally.sdk.ui.cardboard.BasicColumnRenderer.call(this, board, value, options);
 
            var that = this;
            var dndContainer;
            var cards = 0;
            var columnDiv;
            var resourcesDisplay;
 
            this.render = function() {
                columnDiv = document.createElement("div");
                dojo.addClass(columnDiv, "column");
 
                var columnHeader = document.createElement("div");
                dojo.addClass(columnHeader, "columnHeader");
                columnHeader.appendChild(document.createTextNode(options.displayValue || value));
                if (options && options.startDate && options.endDate) {
                    resourcesDisplay = document.createElement("div");
                    dojo.addClass(resourcesDisplay,"capacityDisplay");
                    setCapacityText();
                    columnHeader.appendChild(resourcesDisplay);
                }
                columnDiv.appendChild(columnHeader);
                dndContainer = document.createElement("div");
                dojo.addClass(dndContainer, "columnContent");
                columnDiv.appendChild(dndContainer);
 
                return columnDiv;
            };

            function _toPrettyDate(rallyDateStr) {
                var date = rally.sdk.util.DateTime.fromIsoString(rallyDateStr);
                return rally.sdk.util.DateTime.format(date, "M/dd/yy")
            }
 
            function setCapacityText() {
                if (options && options.startDate && options.endDate) {
                    dojo.empty(resourcesDisplay);
                    resourcesDisplay.innerHTML = _toPrettyDate(options.startDate) + " - " + _toPrettyDate(options.endDate);
                }
            }
 
            this.addNoDropClass = function(items) {
                return false;
            };
 
            this.cardRemoved = function(card) {
                cards--;
                setCapacityText();
            };
 
            this.cardAdded = function(card) {
                cards++;
                setCapacityText();
            };
 
            this.getDndContainer = function() {
                return dndContainer;
            };
 
            this.getColumnNode = function() {
                return columnDiv;
            };
 
            this.clear = function() {
                dojo.empty(that.getDndContainer());
                cards = 0;
                setCapacityText();
            };
};

