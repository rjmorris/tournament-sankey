d3.queue()
    .defer(d3.csv, 'teams.csv')
    .defer(d3.json, 'data.json')
    .await(createDiagram)
;

function createDiagram(error, teams, data) {

    //==========================================================================
    // Pre-process the data.

    // For easier team lookups, map the team IDs to team objects.
    var teamsMap = {};
    _.each(teams, function(d) {
        teamsMap[d.team] = d;
    });

    // For easier game lookups, map the games IDs to game objects.
    var gamesMap = {};
    _.each(data, function(d) {
        gamesMap[d.id] = d;
    });

    // Get the list of games in each round.
    var gamesByRound = _.groupBy(data, function(game) {
        return game.round;
    });

    // Replace the IDs of connected games with the game objects.
    _.each(data, function(d) {
        if (d.toGame !== null) {
            d.toGame = gamesMap[d.toGame];
        }
        if (d.fromGame1 !== null) {
            d.fromGame1 = gamesMap[d.fromGame1];
        }
        if (d.fromGame2 !== null) {
            d.fromGame2 = gamesMap[d.fromGame2];
        }
    });

    // Extract each pick into its own element of an array.
    var picks = _.flatten(
        _.map(data, function(d) {
            var cumulativeProportion = 0;
            return _.map(d.picks, function(proportion, team) {
                var obj = {
                    fromGame: d,
                    toGame: d.toGame,
                    topBracket: (d.toGame === null) ? false : d.toGame.fromGame1 === d,
                    team: team,
                    proportion: proportion,
                    cumulativeProportion: cumulativeProportion
                };
                cumulativeProportion += obj.proportion;
                return obj;
            });
        })
    );

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
        .paddingOuter(0.25)
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

    // Store the vertex points defining each game's funnel.
    _.each(data, function(d) {
        d.funnel = {
                in: {
                    top: {
                        x: xScale(d.round),
                        y: yScales[d.round]['in'](d.id)
                    },
                    bottom: {
                        x: xScale(d.round),
                        y: yScales[d.round]['in'](d.id) + yScales[d.round]['in'].bandwidth()
                    }
                },
            out: {
                top: {
                    x: xScale(d.round) + xScale.bandwidth(),
                    y: yScales[d.round]['out'](d.id)
                },
                bottom: {
                    x: xScale(d.round) + xScale.bandwidth(),
                    y: yScales[d.round]['out'](d.id) + yScales[d.round]['out'].bandwidth()
                }
            }
        };
    });

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
            path.moveTo(d.funnel.in.top.x, d.funnel.in.top.y);
            path.lineTo(d.funnel.in.bottom.x, d.funnel.in.bottom.y);
            path.lineTo(d.funnel.out.bottom.x, d.funnel.out.bottom.y);
            path.lineTo(d.funnel.out.top.x, d.funnel.out.top.y);
            path.closePath();
            return path.toString();
        })
    ;

    var pickFlows = chart.selectAll('.pick-flow')
        .data(picks)
        .enter()
        .append('g')
        .classed('pick-flow', true)
    ;

    pickFlows.append('rect')
        .attr('x', function(d) {
            return d.fromGame.funnel.out.top.x;
        })
        .attr('y', function(d) {
            return d.fromGame.funnel.out.top.y + d.cumulativeProportion * (d.fromGame.funnel.out.bottom.y - d.fromGame.funnel.out.top.y);
        })
        .attr('width', function(d) {
            return 1/3*xScale.bandwidth();
        })
        .attr('height', function(d) {
            return d.proportion * (d.fromGame.funnel.out.bottom.y - d.fromGame.funnel.out.top.y);
        })
        .style('fill', function(d) {
            return teamsMap[d.team].color;
        })
    ;

    pickFlows.filter(function(d) {
        return d.toGame !== null;
    }).append('rect')
        .attr('x', function(d) {
            return d.toGame.funnel.in.top.x - 1/3*xScale.bandwidth();
        })
        .attr('y', function(d) {
            return d.toGame.funnel.in.top.y + (!d.topBracket * 0.5 + d.cumulativeProportion / 2) * (d.toGame.funnel.in.bottom.y - d.toGame.funnel.in.top.y);
        })
        .attr('width', function(d) {
            return 1/3*xScale.bandwidth();
        })
        .attr('height', function(d) {
            return d.proportion * (d.toGame.funnel.in.bottom.y - d.toGame.funnel.in.top.y) / 2;
        })
        .style('fill', function(d) {
            return teamsMap[d.team].color;
        })
    ;

    pickFlows.filter(function(d) {
        return d.toGame !== null;
    }).append('line')
        .attr('x1', function(d) {
            return d.fromGame.funnel.out.top.x + 1/3*xScale.bandwidth();
        })
        .attr('y1', function(d) {
            return d.fromGame.funnel.out.top.y + (d.cumulativeProportion + d.proportion / 2) * (d.fromGame.funnel.out.bottom.y - d.fromGame.funnel.out.top.y);
        })
        .attr('x2', function(d) {
            return d.toGame.funnel.in.top.x - 1/3*xScale.bandwidth();
        })
        .attr('y2', function(d) {
            return d.toGame.funnel.in.top.y + (!d.topBracket * 0.5 + d.cumulativeProportion / 2 + d.proportion / 4) * (d.toGame.funnel.in.bottom.y - d.toGame.funnel.in.top.y);
        })
        .style('stroke', function(d) {
            return teamsMap[d.team].color;
        })
    ;
}
