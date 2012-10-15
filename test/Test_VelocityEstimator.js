(function() {
    function _createMockDataSource(iterations, cfds) {
        function _find(queries, callback) {
            var query = null;
            if(dojo.isArray(queries)) {
                query = queries[0];
            } else {
                query = queries;
            }

            var result = {};
            if(query.type.toLowerCase() === 'iteration') {
                result[query.key] = iterations;
            } else if(query.type.toLowerCase() === 'iterationcumulativeflowdata') {
                if(cfds && cfds.length) {
                    result[query.key] = cfds.shift();
                } else {
                    result[query.key] = [];
                }
            }
            callback(result);
        }
        return {
            find: _find,
            findAll: _find
        };         
    }

    VelocityEstimatorTest = rally.sdk.test.createTestObject('VelocityEstimatorTest');

    VelocityEstimatorTest.prototype.testConstructionWithNullRallyDataSource = function() {
        assertException("should throw an exception if constructed with a null data source", function() {
            var ve = new flsp.VelocityEstimator(null, null);
        });
    };

    VelocityEstimatorTest.prototype.testThrowsIfDisplayCalledWithoutElement = function() {
        assertException("should throw an exception", function() {
            var estimator = new flsp.VelocityEstimator(null, {});
            estimator.display(null);
        });
    };

    VelocityEstimatorTest.prototype.testHandlesProjectOidsInScopeHangman = function() {
        var projectOidHangman = "3,4,5";

        var estimator = new flsp.VelocityEstimator(null, {}, projectOidHangman);
        
        assertEquals("project oids not handled correctly", 3, estimator.getProjectsInScopeCount());
    };

    VelocityEstimatorTest.prototype.testIgnoresHangmanIfNotProvided = function() {
        var estimator = new flsp.VelocityEstimator(null, {});
        
        assertEquals("unexpected scope count", null, estimator.getProjectsInScopeCount());
    };

    VelocityEstimatorTest.prototype.testHonorsUserConfig = function() {
        var expectedIterationCount = 23;
        var expectedSampleSize = 4;
        var userConfig = { iterationCount: expectedIterationCount, sampleSize: expectedSampleSize };

        var estimator = new flsp.VelocityEstimator(userConfig, {});

        assertEquals("iteration count unexpected", expectedIterationCount, estimator.getIterationCount());
        assertEquals("sample size unexpected", expectedSampleSize, estimator.getSampleSize());
    };

    VelocityEstimatorTest.prototype.testFiresBeginVelocityCalculatingEvent = function() {
        var estimator = null;

        try {
            var rallyDataSource = _createMockDataSource([], []);

            estimator = new flsp.VelocityEstimator(null, rallyDataSource);
            var eventFired = false;

            estimator.addEventListener(estimator.getValidEvents().onBeginVelocityCalculating, function(sender, e) {
                eventFired = true;
                assertEquals("for events, sender object should be the estimator", estimator, sender);
                assertEquals("no data should be associated with this event", {}, e);
            });

            var element = document.createElement("div");
            estimator.display(element);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };

    VelocityEstimatorTest.prototype.testFiresOnVelocityChangedEvent = function() {
        var estimator = null;
        try {
            var rallyDataSource = _createMockDataSource([], []);

            estimator = new flsp.VelocityEstimator(null, rallyDataSource);
            var onBeginEventFired = false;
            var velocityChangedFired = false;

            expectAsserts(2);

            estimator.addEventListener(estimator.getValidEvents().onBeginVelocityCalculating, function(sender, e) {
                onBeginEventFired = true;
            });

            estimator.addEventListener(estimator.getValidEvents().onVelocityChanged, function(sender, e) {
                assertTrue("begin velocity calculating should have fired first", onBeginEventFired);
                velocityChangedFired = true;
            });

            var element = document.createElement("div");
            estimator.display(element);

            assertTrue("velocity changed should have been fired", velocityChangedFired);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };

    VelocityEstimatorTest.prototype.testCalculatesVelocity_NoIterations = function() {
        var estimator = null;
        try {
            var rallyDataSource = _createMockDataSource([], []);

            estimator = new flsp.VelocityEstimator(null, rallyDataSource);

            expectAsserts(1);

            estimator.addEventListener(estimator.getValidEvents().onVelocityChanged, function(sender, e) {
                assertEquals("velocity should be zero", 0, e.velocity);
            });

            var element = document.createElement("div");
            estimator.display(element);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };
    
    VelocityEstimatorTest.prototype.testCalculatesVelocity_NoCFDs = function() {
        var estimator = null;
        try {
            var iterations = [
                { ObjectID: 1, EndDate: 'October 1, 2011 11:13:00' },
                { ObjectID: 2, EndDate: 'October 1, 2012 11:13:00' },
                { ObjectID: 3, EndDate: 'October 1, 2013 11:13:00' }
            ];

            var rallyDataSource = _createMockDataSource(iterations, []);

            estimator = new flsp.VelocityEstimator(null, rallyDataSource);

            expectAsserts(1);

            estimator.addEventListener(estimator.getValidEvents().onVelocityChanged, function(sender, e) {
                assertEquals("velocity should be zero", 0, e.velocity);
            });

            var element = document.createElement("div");
            estimator.display(element);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };

    VelocityEstimatorTest.prototype.testCalculatesVelocity_Basic = function() {
        var estimator = null;
        try {
            var iterations = [
                { ObjectID: 1, EndDate: 'October 1, 2011 11:13:00' },
                { ObjectID: 2, EndDate: 'October 1, 2012 11:13:00' },
                { ObjectID: 3, EndDate: 'October 1, 2013 11:13:00' }
            ];

            var cardEstimateTotals = [ 10, 20, 30 ];

            var cfds = [];
            var cardEstimateTotalSum = 0;

            dojo.forEach(cardEstimateTotals, function(total) {
                cfds.push( [ { CardEstimateTotal: total } ]);
                cardEstimateTotalSum += total;
            });

            var expectedVelocity = cardEstimateTotalSum / cfds.length;

            var rallyDataSource = _createMockDataSource(iterations, cfds);

            estimator = new flsp.VelocityEstimator(null, rallyDataSource);

            expectAsserts(2);

            estimator.addEventListener(estimator.getValidEvents().onVelocityChanged, function(sender, e) {
                assertEquals("velocity unexpected", expectedVelocity, e.velocity);
                assertEquals("allVelocities unexpected", { best: expectedVelocity, worst: expectedVelocity, recent: expectedVelocity }, e.allVelocities);
            });

            var element = document.createElement("div");
            estimator.display(element);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };

    VelocityEstimatorTest.prototype.testCalculatesVelocity_IterationsAndCFDs = function() {
        var estimator = null;
        try {
            var userConfig = { iterationCount: 3, sampleSize: 2 };
            var numProjectsInScope = 2;
            var oidHangman = "2,3"; // 2 projects in scope, their IDs are not important, just that there are two

            var numIterationsToGet = userConfig.sampleSize * userConfig.iterationCount;

            var iterations = [
                { ObjectID: 1, Name: "iter1", StartDate: "August 1, 2009 11:13:00", EndDate: "October 1, 2009 11:13:00" },
                { ObjectID: 2, Name: "iter1", StartDate: "August 1, 2009 11:13:00", EndDate: "October 1, 2009 11:13:00" },
                { ObjectID: 3, Name: "iter2", StartDate: "August 1, 2008 11:13:00", EndDate: "October 1, 2008 11:13:00" },
                { ObjectID: 4, Name: "iter2", StartDate: "August 1, 2008 11:13:00", EndDate: "October 1, 2008 11:13:00" },
                { ObjectID: 5, Name: "iter3", StartDate: "August 1, 2007 11:13:00", EndDate: "October 1, 2007 11:13:00" },
                { ObjectID: 6, Name: "iter3", StartDate: "August 1, 2007 11:13:00", EndDate: "October 1, 2007 11:13:00" }
            ];

            var cfds = [
                [ { CardEstimateTotal: 10 }, { CardEstimateTotal: 20 } ],
                [ { CardEstimateTotal: 20 }, { CardEstimateTotal: 15 } ],
                [ { CardEstimateTotal: 30 }, { CardEstimateTotal: 20 } ],
                [ { CardEstimateTotal: 30 }, { CardEstimateTotal: 15 } ],
                [ { CardEstimateTotal: 18 }, { CardEstimateTotal: 12 } ],
                [ { CardEstimateTotal: 10 }, { CardEstimateTotal: 20 } ]
            ];

            var expectedBestVelocity = 45;
            var expectedWorstVelocity = 29;
            var expectedRecentVelocity = 45;

            var rallyDataSource = _createMockDataSource(iterations, cfds);

            estimator = new flsp.VelocityEstimator(userConfig, rallyDataSource, oidHangman);

            expectAsserts(1);

            estimator.addEventListener(estimator.getValidEvents().onVelocityChanged, function(sender, e) {
                assertEquals("allVelocities unexpected", { 
                    best: expectedBestVelocity,
                    worst: expectedWorstVelocity,
                    recent: expectedRecentVelocity
                }, e.allVelocities);
            });

            var element = document.createElement("div");
            estimator.display(element);
        } finally {
            if(estimator) {
                estimator.destroy();
            }
        }
    };
})();

