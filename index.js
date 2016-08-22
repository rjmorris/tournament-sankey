d3.json("data.json", function(data) {
    //==========================================================================
    // Pre-process the data.

    // For easier game lookup, map the games IDs to game objects.
    var gamesMap = _.groupBy(data, function(game) {
        return game.id;
    });

    // Get the list of games in each round.
    var gamesByRound = _.groupBy(data, function(game) {
        return game.round;
    });

    // Replace the IDs of connected games with the game objects.
    _.each(data, function(d) {
        if (d.feeds) {
            d.feeds = gamesMap[d.feeds];
        }
        if (d.fedby) {
            _.each(d.fedby, function(fedbyId, i) {
                d.fedby[i] = gamesMap[fedbyId];
            });
        }
    });

    var rounds = _.chain(data)
        .pluck('round')
        .uniq()
        .value()
    ;

    var numRounds = rounds.length;


    //==========================================================================
    // Create the graphic elements.

    var margin = {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10
    };
    var width = 800 - margin.left - margin.right;
    var height = 800 - margin.top - margin.bottom;

    var svg = d3.select("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    ;

    var chart = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    ;

    var xScale = d3.scaleBand()
        .domain(rounds)
        .range([0,width])
        .paddingInner(0.5)
    ;

    function createYScale(round) {
        return {
            'in': d3.scaleBand()
                .domain(_.pluck(gamesByRound[round], 'id'))
                .range([0, height])
                .paddingInner(1 - Math.pow(0.5, round - 1))
                .paddingOuter(0.5 - Math.pow(0.5, round))
            ,
            'out': d3.scaleBand()
                .domain(_.pluck(gamesByRound[round], 'id'))
                .range([0, height])
                .paddingInner(1 - Math.pow(0.5, round))
                .paddingOuter(0.5 - Math.pow(0.5, round) + Math.pow(0.5, round + 1))
        }
    }

    yScales = _.object(rounds, _.map(rounds, function(round) {
        return createYScale(round);
    }));

    var gameFunnels = chart.selectAll('.game-funnel')
        .data(data)
        .enter()
        .append('g')
        .classed('game-funnel', true)
    ;

    gameFunnels
        .append('path')
        .attr('d', function(d) {
            path = d3.path();
            path.moveTo(xScale(d.round), yScales[d.round]['in'](d.id));
            path.lineTo(xScale(d.round), yScales[d.round]['in'](d.id) + yScales[d.round]['in'].bandwidth());
            path.lineTo(xScale(d.round) + xScale.bandwidth(), yScales[d.round]['out'](d.id) + yScales[d.round]['out'].bandwidth());
            path.lineTo(xScale(d.round) + xScale.bandwidth(), yScales[d.round]['out'](d.id));
            path.closePath();
            return path.toString();
        })
    ;
});
