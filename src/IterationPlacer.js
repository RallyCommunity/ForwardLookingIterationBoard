var flsp = flsp || {};

flsp.IterationPlacer = function flsp_IterationPlacer(iterations, fallback) {
    // private methods
    function _init(iterations) {
        if(typeof iterations === 'undefined' || iterations === null) {
            throw new Error("IterationPlacer: given no iterations");
        }

        if(!dojo.isArray(iterations)) {
            throw new Error("IterationPlacer: iterations must be an array");
        }
    }

    function _sortIterations(iterations) {
        iterations.sort(function(a, b) {
            var dateA = new Date(a.StartDate);
            var dateB = new Date(b.StartDate);

            if(dateA > dateB) {
                return 1;
            } else if(dateA < dateB) {
                return -1;
            } else {
                return 0;
            }
        });
    }

    function _sortItems(items) {
        items.sort(function(a, b) {
            var aRank = (a.Rank || 0), bRank = (b.Rank || 0);
            return aRank - bRank;
        });
    }

    function _isAssignable(item) {
        return (item.PlanEstimate && item.PlanEstimate > 0);
    }

    function _placeItem(iterations, item) {
        // this method assumes iterations have been sorted by date
        // which they are when this object is first created
      
        var iteration, i;

        for(i = 0; i < iterations.length; i += 1 ) {
            iteration = iterations[i];
            if(iteration.AvailableCapacity >= item.PlanEstimate) {
                iteration.AvailableCapacity -= item.PlanEstimate;
               item.ProposedIteration = iteration.Name;
               break;
            }
        }
    }

    function _setAssignedItems(iterations, assignedItems) {
        var i, ai;
        dojo.forEach(iterations, function(iteration) {
            for(i = 0; i < assignedItems.length; i += 1) {
                ai = assignedItems[i];

                if(ai.Iteration.ObjectID === iteration.ObjectID) {
                    ai.IsPreAssigned = true;
                    iteration.AvailableCapacity -= (ai.PlanEstimate || 0);
                    ai.ProposedIteration = iteration.Name;
                }
            }
        });
    }

    _init(iterations);
    _sortIterations(iterations);

    this.placeItems = function IterationPlacer_placeItems(backlogItems, assignedItems) {
        var item, i;

        if(assignedItems) {
            _setAssignedItems(iterations, assignedItems);
        }

        if(!backlogItems) {
            throw new Error("IterationPlacer.placeItems: not given any backlog items");
        }

        if(!dojo.isArray(backlogItems)) {
            throw new Error("IterationPlacer.placeItems: backlog items must be an array");
        }

        _sortItems(backlogItems);

        for(i = 0; i < backlogItems.length; i += 1) {
            item = backlogItems[i];

            // default response, no proposed iteration
            item.ProposedIteration = fallback;

            if(_isAssignable(item)) {
              _placeItem(iterations, item);
            }
        }
    };
};

