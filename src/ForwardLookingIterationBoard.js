function ForwardLookingIterationBoard(rallyDataSource, projectOidsInScopeHangman) {
    var _iterations;
    var _cardboard;
    var _checkBoxes = [];
    var _velocity;

    function _refreshBoard() {
        var cardboardConfig = {
            types: [],
            attribute: "ProposedIteration",
            columns: _getColumns,
            maxCardsPerColumn: 100,
            items: _getItems,
            cardRenderer: ForwardLookingIterationBoardCardRenderer,
            columnRenderer: ForwardLookingIterationBoardColumnRenderer,
            sortAscending: true,
            order: "Rank",
            readOnly: true
        };

        //Build types based on checkbox selections
        dojo.forEach(_checkBoxes, function(checkBox) {
            if (checkBox.getChecked()) {
                cardboardConfig.types.push(checkBox.getValue());
            }
        });

        if (!_cardboard) {
            if (cardboardConfig.types.length === 0) {
                _checkBoxes[0].setChecked(true);
                cardboardConfig.types.push(_checkBoxes[0].getValue());
            }
            _cardboard = new rally.sdk.ui.CardBoard(cardboardConfig, rallyDataSource);
            _cardboard.addEventListener("preUpdate", function(c, args) {
                if (parseInt(args.fieldsToUpdate.PlanEstimate, 10) === 0) {
                    args.fieldsToUpdate.PlanEstimate = null;
                }
            });
            _cardboard.display("cardBoard");
        } else {
            _cardboard.refresh(cardboardConfig);
        }
    }

    function _groupIterations(rawIterations) {
        var grouped = [];
        var alreadyGrouped;

        dojo.forEach(rawIterations, function(rawIteration) {
            alreadyGrouped = dojo.some(grouped, function(inList) {
                return inList.Name === rawIteration.Name &&
                    inList.StartDate === rawIteration.StartDate &&
                    inList.EndDate === rawIteration.EndDate;
            });

            if(!alreadyGrouped) {
                grouped.push(rawIteration);
            }
        });

        return grouped;
    }

    function _getIterations(callback) {
        query = [{
            key: 'futureIterations',
            type: 'iteration',
            fetch: 'name,PlanEstimate,StartDate,EndDate,ObjectID',
            query: '(StartDate > "' + rally.sdk.util.DateTime.toIsoString(new Date()) + '")',
            order: 'StartDate asc'
        }];

        rallyDataSource.findAll(query, function(result) {
            var grouped = _groupIterations(result.futureIterations);
            callback(grouped);
        }, function(errorResult) {
            alert(errorResult.errors.join(':'));
        });
    }

    function _onVelocityChanged(sender, e) {
      _velocity = e.velocity;
      _refreshBoard();
    }

    function _warnOfNoIterations(element) {
        var warningMessage = 
            "No future iterations are defined. Iterations with a start date in the future are needed for this app to operate.";

        var warningDiv = document.createElement("div");
        warningDiv.innerHTML = warningMessage;
        dojo.addClass(warningDiv, "appMessage warning");
        element.appendChild(warningDiv);

        rally.Logger.warn(warningMessage);
    }

    function _createLayout(element) {
        rally.sdk.ui.AppHeader.showPageTools(true);
        rally.sdk.ui.AppHeader.setHelpTopic("/display/rlyhlpstging/Forward-Looking+Iteration+Board+App");

        if(_iterations.length === 0) {
            _warnOfNoIterations(element);
        } else {
            var headerDiv = document.createElement("div");
            element.appendChild(headerDiv);

            // checkboxes

            var checkBoxContainer = document.createElement("div");
            dojo.addClass(checkBoxContainer, "typeFilterContainer");
            headerDiv.appendChild(checkBoxContainer);


            var showSpan = dojo.create("span", { style: 'display:inline-block' }, checkBoxContainer);
            showSpan.appendChild(document.createTextNode("Show:"));

            var userStoriesSpan = document.createElement("span");
            userStoriesSpan.id = "userStories";
            checkBoxContainer.appendChild(userStoriesSpan);

            var userStoriesCheckBox = new rally.sdk.ui.basic.Checkbox({
                showLabel: true,
                label: "User Stories",
                labelPosition: "after",
                value: "HierarchicalRequirement",
                checked: true
            });

            _checkBoxes.push(userStoriesCheckBox);
            userStoriesCheckBox.display(userStoriesSpan);

            var defectsSpan = document.createElement("span");
            defectsSpan.id = "defects";
            checkBoxContainer.appendChild(defectsSpan);

            var defectsCheckBox = new rally.sdk.ui.basic.Checkbox({
                showLabel: true,
                label: "Defects",
                labelPosition: "after",
                value: "Defect"
            });
            _checkBoxes.push(defectsCheckBox);
            defectsCheckBox.display(defectsSpan);

            var defectSuitesSpan = document.createElement("span");
            defectSuitesSpan.id = "defectSuites";
            checkBoxContainer.appendChild(defectSuitesSpan);

            var defectSuitesCheckBox = new rally.sdk.ui.basic.Checkbox({
                showLabel: true,
                label: "Defect Suites",
                labelPosition: "after",
                value: "DefectSuite"
            });
            _checkBoxes.push(defectSuitesCheckBox);
            defectSuitesCheckBox.display(defectSuitesSpan);

            // velocity estimator settings
            
            var velocityEstimatorDiv = dojo.create("div", { id: '_velocityEstimatorContainer' }, headerDiv, "last");
            var velocityEstimator = new flsp.VelocityEstimator(null, rallyDataSource, projectOidsInScopeHangman);
            
            velocityEstimator.addEventListener('onVelocityChanged', _onVelocityChanged);
            velocityEstimator.display(velocityEstimatorDiv);
            
            // cardboard

            var kanbanBoard = document.createElement("div");
            kanbanBoard.id = "cardBoard";
            dojo.addClass(kanbanBoard, "cardBoard");
            element.appendChild(kanbanBoard);

            //Wire up events
            dojo.forEach(_checkBoxes, function(checkBox) {
                checkBox.addEventListener("onChange", _refreshBoard);
            });
        }
    }

    function _getColumns(callback) {
        var columns = {'Backlog': {displayValue: 'Backlog'}};
        rally.forEach(_iterations, function(iteration) {
            columns[iteration.Name] = { displayValue: iteration.Name, startDate: iteration.StartDate, endDate: iteration.EndDate };
        });
        callback(columns);
    }

    function _runBatchQueries(queries, callback) {
        var storedResults = {};
        var outstandingQueries = queries.length;

        function gatherResults(results) {
            dojo.mixin(storedResults, results);
            outstandingQueries -= 1;
            if(outstandingQueries === 0) {
                callback(storedResults);
            }
        }

        if(outstandingQueries === 0) {
            callback(storedResults);
        } else {
            dojo.forEach(queries, function(query) {
                rallyDataSource.find(query, gatherResults);
            });
        }
    }

    function _getItems(callback) {

        //Build types based on checkbox selections
        var queries = [];
        dojo.forEach(_checkBoxes, function(checkBox) {
            if (checkBox.getChecked()) {
                queries.push({key:checkBox.getValue(),
                    type: checkBox.getValue(),
                    fetch: "Name,FormattedID,Owner,ObjectID,Rank,PlanEstimate,Iteration,Ready",
                    query: '(iteration = "null")',
                    order: 'Rank desc'
                });
                dojo.forEach(_iterations, function(iteration) {
                    queries.push({key:checkBox.getValue() + "_assigned_to_" + iteration.ObjectID,
                        type: checkBox.getValue(),
                        fetch: "Name,FormattedID,Owner,ObjectID,Rank,PlanEstimate,Iteration,Ready",
                        query: '((iteration != "null") and (iteration.ObjectId = ' + iteration.ObjectID + '))'
                    });
                });
            }
        });

        function initIterations(iterations, max) {
            rally.forEach(iterations, function(iteration) {
                iteration.AvailableCapacity = max;
            });
        }

        function assignIterations(results) {
            initIterations(_iterations, _velocity);
  
            var userStories = results.HierarchicalRequirement || [];
            var defects = results.Defect || [];
            var defectSuites = results.DefectSuite || [];
            var backlogItems = userStories.concat(defects, defectSuites);
  
            var assignedItems = [];

            dojo.forEach(_iterations, function(iteration) {
                dojo.forEach(_checkBoxes, function(checkBox) {
                    if(checkBox.getChecked()) {
                        assignedItems = assignedItems.concat(results[checkBox.getValue() + "_assigned_to_" + iteration.ObjectID] || []);
                    }
                });
            });
  
            var placer = new flsp.IterationPlacer(_iterations, "Backlog");
            placer.placeItems(backlogItems, assignedItems);
  
            callback(backlogItems.concat(assignedItems));
        }

        _runBatchQueries(queries, assignIterations);
    }

    this.display = function(element) {
        _getIterations(function(iterations) {
            _iterations = iterations || [];
            _createLayout(element);
        });
    };
}

