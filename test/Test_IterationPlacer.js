(function() {
    function _createIterations(quantity, capacity, nameRoot) {
        quantity = quantity || 5;
        capacity = capacity || 10;
        nameRoot = nameRoot || "testIteration";


        var iterations = [];
        for(var i = 0; i < quantity; ++i) {
            iterations.push({AvailableCapacity: capacity, Name: nameRoot + i, StartDate: "October 1, 2009 11:13:00", ObjectID: i });
        }

        return iterations;
    }

    IterationPlacerTest = rally.sdk.test.createTestObject('IterationPlacerTest');

    IterationPlacerTest.prototype.testConstructionWithNoIterations = function() {
        assertException("Should have thrown an exception if constructed with no iterations", function() {
            var ip = new flsp.IterationPlacer();
        });
    };

    IterationPlacerTest.prototype.testThrowsIfGivenNullItems = function() {
        assertException("Should have thrown an exception if given null items", function() {
            var placer = new flsp.IterationPlacer(_createIterations());
            placer.placeItems(null);
        });
    };

    IterationPlacerTest.prototype.testSortsIterationsCorrectly = function() {
        var iterations = [
            { StartDate: 'October 1, 2011 11:13:00', Name: 'should come last' },
            { StartDate: 'October 1, 2007 11:13:00', Name: 'should come first' },
            { StartDate: 'October 1, 2009 11:13:00', Name: 'should come third' },
            { StartDate: 'October 1, 2008 11:13:00', Name: 'should come second' }
        ];

        var placer = new flsp.IterationPlacer(iterations);

        assertEquals("iterations not sorted correctly", 'should come first', iterations[0].Name);
        assertEquals("iterations not sorted correctly", 'should come second', iterations[1].Name);
        assertEquals("iterations not sorted correctly", 'should come third', iterations[2].Name);
        assertEquals("iterations not sorted correctly", 'should come last', iterations[3].Name);
    };

    IterationPlacerTest.prototype.testSortsItemsCorrectly = function() {
        var iterations = _createIterations(4, 20, "testIteration");

        var items = [
            { Rank: 5, Name: 'last' },
            { Rank: 9, Name: 'first' },
            { Rank: 7, Name: 'third' },
            { Rank: 8, Name: 'second' }
        ];

        var placer = new flsp.IterationPlacer(iterations);

        placer.placeItems(items);

        assertEquals("items not sorted correctly", 'first', items[0].Name);
        assertEquals("items not sorted correctly", 'second', items[1].Name);
        assertEquals("items not sorted correctly", 'third', items[2].Name);
        assertEquals("items not sorted correctly", 'last', items[3].Name);
    };

    IterationPlacerTest.prototype.testSetsUserStoryToFirstIteration = function() {
        var iterations = _createIterations(4, 20, "testIteration");
        var userStory = { PlanEstimate: 10 };

        var placer = new flsp.IterationPlacer(iterations);

        placer.placeItems([userStory]);

        assertEquals("Did not set story to expected iteration", "testIteration0", userStory.ProposedIteration);
    };

    IterationPlacerTest.prototype.testSetsUserStoryToSecondIterationBecauseFirstIsFull = function() {
        var iterations = _createIterations(4, 20, "testIteration");
        iterations[0].AvailableCapacity = 3;
        iterations[1].AvailableCapacity =    10;

        var userStory = { PlanEstimate: 5 };

        var placer = new flsp.IterationPlacer(iterations);

        placer.placeItems([userStory]);

        assertEquals("Did not set story to expected iteration", "testIteration1", userStory.ProposedIteration);
    };

    IterationPlacerTest.prototype.testSetsUserToNoIterationBecauseAllIterationsAreFull = function() {
        var iterations = _createIterations(4, 20, "testIteration");
        dojo.forEach(iterations, function(iteration) { iteration.AvailableCapacity = 2; });

        var userStory = { PlanEstimate: 5 };
        var fallback = "fallbackColumn";

        var placer = new flsp.IterationPlacer(iterations, fallback);

        placer.placeItems([userStory]);

        assertEquals("Should have placed into the fall back", fallback, userStory.ProposedIteration);
    };

    IterationPlacerTest.prototype.testPlacesItemInFallbackIfDoesntFitInAnyIterations = function() {
        var iterations = _createIterations(4, 20, "testIteration");
        dojo.forEach(iterations, function(iteration) { iteration.AvailableCapacity = 2; });

        var userStory = { PlanEstimate: null };
        var fallback = "fallBackColumn";

        var placer = new flsp.IterationPlacer(iterations, fallback);

        placer.placeItems([userStory]);

        assertEquals("Should have placed into the fall back", fallback, userStory.ProposedIteration);
    };
    
    IterationPlacerTest.prototype.testDoesNotPlaceItemBecauseItsPlanEstimateIsZero = function() {
        var iterations = _createIterations(4, 20, "testIteration");
        dojo.forEach(iterations, function(iteration) { iteration.AvailableCapacity = 2; });

        var userStory = { PlanEstimate: 0 };
        var fallback = "fallbackColumn";

        var placer = new flsp.IterationPlacer(iterations, fallback);

        placer.placeItems([userStory]);

        assertEquals("Should have placed into the fallback because it has no planned estimate", fallback, userStory.ProposedIteration);
    };

    IterationPlacerTest.prototype.testPlacesAssignedItemCorrectly = function() {
        var capacity = 20;
        var targetIterationName = "targetIteration";
        var iterations = _createIterations(4, capacity, "testIteration");
        var targetIteration = _createIterations(1, capacity, targetIterationName)[0];

        var fallback = "fallbackColumn";
        var placer = new flsp.IterationPlacer(iterations, fallback);

        var targetIterationID = 20;
        var storyPlanEstimate = 5;

        targetIteration.ObjectID = targetIterationID;
        iterations.push(targetIteration);

        var assignedStory = {
            Iteration: {
                ObjectID: targetIterationID
            },
            PlanEstimate: storyPlanEstimate
        };

        placer.placeItems([], [assignedStory]);

        assertEquals("assigned item should have affected its assigned iteration's capacity", capacity - storyPlanEstimate, targetIteration.AvailableCapacity);
        assertEquals("assignedStory should have been given its actual iteration as its proposed iteration", targetIterationName + "0", assignedStory.ProposedIteration);

        for(var i = 0; i < iterations.length; ++i) {
            if(iterations[i] !== targetIteration) {
                assertEquals("The other iterations should not have been affected by the assigned item", capacity, iterations[i].AvailableCapacity);
            }
        }
    };

    // when dealing with items that are already assigned to our iterations in Rally, we need to let them clobber
    // available capacity and push it to negative if that is the reality
    IterationPlacerTest.prototype.testPlacesAssignedItemsEvenIfThisViolatesCapacity = function() {
        var capacity = 20;
        var targetIterationName = "targetIteration";
        var iterations = _createIterations(4, capacity, "testIteration");
        var targetIteration = _createIterations(1, capacity, targetIterationName)[0];

        var fallback = "fallbackColumn";
        var placer = new flsp.IterationPlacer(iterations, fallback);

        var targetIterationID = 20;
        var storyPlanEstimate = 5;

        targetIteration.ObjectID = targetIterationID;
        iterations.push(targetIteration);

        var assignedStories = [];
        var assignedStoryCount = 10;

        for(var i = 0; i < assignedStoryCount; ++i) {
            assignedStories.push({
                Iteration: {
                    ObjectID: targetIterationID
                },
                PlanEstimate: storyPlanEstimate
            });
        }

        placer.placeItems([], assignedStories);

        assertEquals("assignedStories should have pushed the target iteration's capacity into negative",
            capacity - (assignedStoryCount * storyPlanEstimate), targetIteration.AvailableCapacity);
    };
})();
    
