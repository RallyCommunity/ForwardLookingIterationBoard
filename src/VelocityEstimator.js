var flsp = flsp || {};

flsp.VelocityEstimator = function VelocityEstimator(userConfig, rallyDataSource, projectOidsInScopeHangman) {
    rally.sdk.ComponentBase.call(this);

    var that = this;

    // private members, UI related
    var _targetElement;
    var _displayContainer;
    var _velocityTitleLabel;
    var _velocityLabel;
    var _editButton;
    var _editContainer;
    var _velocityDropdownContainer;
    var _velocityTypeDropdown;
    var _customTextContainer;
    var _customTextBox;
    var _finishEditButton;
    
    // private members, calculation related
    var _projectsInScopeCount = null;
    var _rallyDataSource;
    var _finalScheduleStateValue;
    var _iterationCount = 10;
    var _sampleSize = 3;
    var _velocities;
    var _best = 'best';
    var _worst = 'worst';
    var _recent = 'recent';
    var _custom = 'custom';
    var _currentVelocityType = _recent;

    var _velocityDisplayMap = {
        best : 'Best',
        worst : 'Worst',
        recent : 'Most Recent',
        custom: 'Custom'
    };
    
    // private methods

    function _showDisplayContainer() {
        dojo.style(_editContainer, "display", "none");
        dojo.style(_displayContainer, "display", "");
    }

    function _showEditContainer() {
        dojo.style(_displayContainer, "display", "none");
        dojo.style(_editContainer, "display", "");

        // hack for IE7, it insists on showing the custom textbox, so force it to hide it right before
        // displaying the editor
        if(_currentVelocityType !== _custom) {
            dojo.style(_customTextContainer, "display", "none");
        }
    }

    function _getCurrentVelocity() {
        if(_currentVelocityType === _custom) {
            return parseFloat(_customTextBox.getValue());
        } else {
            return _velocities && _velocities[_currentVelocityType];
        }
    }

    function _setVelocityLabel() {
        var currentVelocity = _getCurrentVelocity();

        if(typeof currentVelocity === 'number' && !isNaN(currentVelocity)) {
            _velocityLabel.innerHTML = currentVelocity;
        } else {
            _velocityLabel.innerHTML = '--';
        }

        _velocityTitleLabel.innerHTML = _velocityDisplayMap[_currentVelocityType] + " Velocity: ";
    }

    function _fireVelocityChanged() {
        that.fireEvent(that.getValidEvents().onVelocityChanged, { velocity: _getCurrentVelocity(), allVelocities: _velocities });
    }

    function _determineProjectsInScopeCount(hangman) {
        // hangman wasn't provided or wasn't resolved
        if(!hangman || hangman === '__PROJECT_OIDS_IN_SCOPE__') {
            return null;
        }

        return hangman.split(',').length;
    }

    function _init(userConfig, rallyDataSource, projectOidsInScopeHangman) {
        if(!rallyDataSource) {
            throw new Error("Missing required argument: rallyDataSource");
        } else {
            _rallyDataSource = rallyDataSource;
            _iterationCount = (userConfig && userConfig.iterationCount) || 10;
            _sampleSize = (userConfig && userConfig.sampleSize) || 3;
            _projectsInScopeCount = _determineProjectsInScopeCount(projectOidsInScopeHangman);
        }
    }

    function _groupIterations(rawIterations) {
        // group the iterations by name, start date and end date, and accumulate CumulativeFlowData
        var groupHash = {}, key, groups = [], group, g;

        dojo.forEach(rawIterations, function(rawIteration) {
            key = rawIteration.Name + rawIteration.StartDate + rawIteration.EndDate;
            group = groupHash[key];

            if(!group) {
                groupHash[key] = rawIteration;
            } else {
                group.VelocityTotal += (rawIteration.VelocityTotal || 0);
            }
        });

        for(g in groupHash) {
            if(groupHash.hasOwnProperty(g)) {
                groups.push(groupHash[g]);
            }
        }
        return groups;
    }

    function _showWarning(message) {
        rally.sdk.ui.AppHeader.showMessage("warning", message, 5000);
        rally.Logger.warn(message);
    }

    function _onEditClicked(sender, e) {
        _showEditContainer();
    }

    function _onFinishEditClicked() {
        var newVelocityType = _velocityTypeDropdown.getValue();

        _showDisplayContainer();
    
        if(_currentVelocityType !== newVelocityType || newVelocityType === _custom) { 
            _currentVelocityType = newVelocityType;
            _setVelocityLabel();
            _fireVelocityChanged();
        }
    }

    function _onVelocityTypeDropdownValueChanged(sender, e) {
        // show or hide the custom textbox based on whether the user chose custom
        var displayValue = e.value === _custom ? "" : "none";
        dojo.style(_customTextContainer, "display", displayValue);
    }

    function _setVelocityDropdownItems() {
        var ss = _sampleSize.toString(), ic = _iterationCount.toString();
        var dropDownItems = [
                { label: ss + ' Most Recent', value: _recent },
                { label: 'Best ' + ss + ' average from past ' + ic, value: _best },
                { label: 'Worst ' + ss + ' average from past ' + ic, value: _worst },
                { label: 'Custom', value: _custom }
            ];

        _velocityTypeDropdown.setItems(dropDownItems);
        _velocityTypeDropdown.display(_velocityDropdownContainer);
    }


    function _getFinalScheduleStateValue(callback) {
        var query = {
            key: 'scheduleStates',
            type: 'Hierarchical Requirement',
            attribute: 'Schedule State'
        };

        _rallyDataSource.find(query, function(result) {
            var finalScheduleState = (result.scheduleStates && result.scheduleStates[result.scheduleStates.length - 1]) || "Accepted";
            callback(finalScheduleState);
        });
    }

    function _getCumulativeFlowData(iteration, callback) {
        var queryString;

        if(_finalScheduleStateValue === 'Accepted') {
            queryString = "(( IterationObjectID = " + iteration.ObjectID + " ) AND (CardState = Accepted))";
        } else {
            queryString = "(( IterationObjectID = " + iteration.ObjectID + " ) AND ((CardState = Accepted) OR (CardState = \"" + _finalScheduleStateValue + "\")))";
        }

        var query = {
            key: 'cfd',
            type: 'IterationCumulativeFlowData',
            query: '((IterationObjectID = ' + iteration.ObjectID + ') and (CardState = Accepted))',
            fetch: 'CardEstimateTotal',
            pagesize: 1,
            order: 'CreationDate desc'
        };

        _rallyDataSource.find(query, function(results) {
            iteration.VelocityTotal = (results.cfd && results.cfd[0] && results.cfd[0].CardEstimateTotal) || 0;
            callback(iteration);
        });
    }

    function _sortByBest(a, b) {
        var bVelocityTotal = b.VelocityTotal || 0;
        var aVelocityTotal = a.VelocityTotal || 0;
        return bVelocityTotal - aVelocityTotal;
    }

    function _sortByWorst(a, b) {
        var bVelocityTotal = b.VelocityTotal || 0;
        var aVelocityTotal = a.VelocityTotal || 0;
        return aVelocityTotal - bVelocityTotal;
    }

    function _sortByRecent(a, b) {
        var dateA = new Date(a.EndDate);
        var dateB = new Date(b.EndDate);
    
        if(dateA < dateB) {
            return 1;
        } else if(dateA > dateB) {
            return -1;
        } else {
            return 0;
        }
    }

    function _determineVelocityWith(iterations, sortFunc) {
        if(!iterations || !iterations.length) {
            return 0;
        }
    
        iterations.sort(sortFunc);
    
        var sample = iterations.slice(0, _sampleSize);
        var sum = 0;
        dojo.forEach(sample, function(e) { sum += e.VelocityTotal || 0; });
    
        var velocity = sum / sample.length;

        return (Math.round(velocity * 100)) / 100;
    }

    function _determineVelocities(completeIterations, callback) {
        if(completeIterations.length === 0) {
            _showWarning("No previous iterations found, a velocity estimate could not be calculated");
        }

        var velocities = {};

        velocities[_best] = _determineVelocityWith(completeIterations, _sortByBest);
        velocities[_worst] = _determineVelocityWith(completeIterations, _sortByWorst);
        velocities[_recent] = _determineVelocityWith(completeIterations, _sortByRecent);

        callback(velocities);
    }

    function _getVelocities(callback) {
        var now = rally.sdk.util.DateTime.toIsoString(new Date()), completeIterations = [];

        _getFinalScheduleStateValue(function(finalValue) {
            var query;
            _finalScheduleStateValue = finalValue;

            // retrieve enough iterations based on how many projects are in scope
            // or default to 200 if we dont currently know the scope (ie running outside of rally)
            var pageSize = (_projectsInScopeCount * _iterationCount) || 200;
            // clamp pagesize to 200
            pageSize = Math.min(200, pageSize);

            query = [
                {
                    key: 'iterations',
                    type: 'Iteration',
                    query: '(EndDate < ' + now + ')',
                    fetch: 'ObjectID,EndDate,StartDate,Name',
                    pagesize: pageSize,
                    order: 'EndDate desc'
                }
            ];

            _rallyDataSource.find(query, function(results) {
                var i;
                if(results.iterations.length === 0) {
                    _determineVelocities(completeIterations, callback);
                }

                function cumulFlowDataCallback(iteration) {
                    completeIterations.push(iteration);
                    if(completeIterations.length === results.iterations.length) {
                        var grouped = _groupIterations(completeIterations);
                        _determineVelocities(grouped, callback);
                    }
                }

                for(i = 0; i < results.iterations.length; i += 1) {
                    _getCumulativeFlowData(results.iterations[i], cumulFlowDataCallback);
                }
            });
        });
    }

    function _beginCalculateVelocity() {    
        _showDisplayContainer();
        _editButton.setEnabled(false);
        that.fireEvent(that.getValidEvents().onBeginVelocityCalculating, {});
        
        dojo.empty(_velocityLabel);
        var wait = new rally.sdk.ui.basic.Wait({ text: '' });
        wait.display(_velocityLabel);
        
        _getVelocities(dojo.hitch(this, function(velocities) {
            wait.hide();

            _velocities = velocities;
    
            _setVelocityLabel();
            _setVelocityDropdownItems();

            _fireVelocityChanged();
            _editButton.setEnabled(true);
        }));
    }
    
    // getters

    this.getProjectsInScopeCount = function ve_getProjectsInScopeCount() {
        return _projectsInScopeCount;
    };

    this.getIterationCount = function ve_getIterationCount() {
        return _iterationCount;
    };

    this.getSampleSize = function ve_getSampleSize() {
        return _sampleSize;
    };

    // public methods

    this.display = function ve_display(element) {
        _targetElement = dojo.byId(element);

        if(!_targetElement) {
            throw new Error("Velocity Estimator requires a display element.");
        }

        dojo.addClass(_targetElement, "velocityEstimator");

        var container = dojo.create("div", { id: _targetElement.id + 'VelocityEstimator' }, _targetElement);

        // display container
        _displayContainer = dojo.create("span", null, container);
        _velocityTitleLabel = dojo.create("span", { innerHTML: "Velocity: " }, _displayContainer);

        _velocityLabel = dojo.create("span", {
                id: _targetElement.id + 'VelocityLabel',
                style: 'font-weight: bold; font-size: 1.5em; min-width: 18px; min-height: 18px; display: inline-block'
            }, _displayContainer);

        var editButtonContainer = dojo.create("span", null, _displayContainer);

        var editButtonConfig = {
            text: "Edit",
            value: "Edit"
        };

        _editButton = new rally.sdk.ui.basic.Button(editButtonConfig);
        _editButton.addEventListener(_editButton.getValidEvents().onClick, _onEditClicked);
        _editButton.display(editButtonContainer);


        // config container
        _editContainer = dojo.create("span", null, container);
        dojo.style(_editContainer, "display", "none");


        var velocityDropdownConfig = {
            label: "Velocity Type",
            showLabel: true,
            rememberSelection: false
        };
        _velocityTypeDropdown = new rally.sdk.ui.basic.Dropdown(velocityDropdownConfig);

        _velocityDropdownContainer = dojo.create("span", null, _editContainer);
        _velocityTypeDropdown.addEventListener('onChange', _onVelocityTypeDropdownValueChanged);

        // config, custom textbox
        _customTextContainer = dojo.create("span", { id: _targetElement.id + 'customTextContainer' } , _editContainer);
        _customTextBox = new rally.sdk.ui.basic.TextBox( { label: "Custom Velocity:", showLabel: true });
        _customTextBox.display(_customTextContainer);
        dojo.style(_customTextContainer, "display", "none");

        // config, OK button
        _finishEditButton = new rally.sdk.ui.basic.Button({ text: "OK" });
        _finishEditButton.addEventListener(_finishEditButton.getValidEvents().onClick, _onFinishEditClicked);
        var finishEditButtonContainer = dojo.create("span", null, _editContainer);
        _finishEditButton.display(finishEditButtonContainer);

        _beginCalculateVelocity();
    };

    this.getValidEvents = function ve_getValidEvents() {
        return {
            onBeginVelocityCalculating: "onBeginVelocityCalculating",
            onVelocityChanged: "onVelocityChanged"
        };
    };

    this.destroy = function ve_destroy() {
        if(_editButton) {
            _editButton.destroy();
            _editButton = null;
        }

        if(_finishEditButton) {
            _finishEditButton.destroy();
            _finishEditButton = null;
        }

        if(_velocityTypeDropdown) {
            _velocityTypeDropdown.destroy();
            _velocityTypeDropdown = null;
        }

        if(_velocityDropdownContainer) {
            dojo.destroy(_velocityDropdownContainer);
            _velocityDropdownContainer = null;
        }

        if(_customTextBox) {
            _customTextBox.destroy();
            _customTextBox = null;
        }

        if(_customTextContainer) {
            dojo.destroy(_customTextContainer);
            _customTextContainer = null;
        }

        if(_velocityLabel) {
            dojo.destroy(_velocityLabel);
            _velocityLabel = null;
        }

        if(_velocityTitleLabel) {
            dojo.destroy(_velocityTitleLabel);
            _velocityTitleLabel = null;
        }

        if(_editContainer) {
            dojo.destroy(_editContainer);
            _editContainer = null;
        }

        if(_displayContainer) {
            dojo.destroy(_displayContainer);
            _displayContainer = null;
        }

        if(_targetElement) {
            dojo.destroy(_targetElement);
            _targetElement = null;
        }
    };

    _init(userConfig, rallyDataSource, projectOidsInScopeHangman);
};

