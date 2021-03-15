var _aggData = []
var _sicTable = {}

Promise.all([
	d3.csv('data/BrazilTradeAggregationL0.csv'),
	d3.csv('data/BrazilTradeAggregationL1.csv'),
	d3.csv('data/BrazilTradeAggregationL2.csv'),
	d3.csv('data/BrazilTradeAggregationL3.csv'),
	d3.csv('data/SIC_table.csv')
]).then(([l0, l1, l2, l3, sicTable]) => {
	_aggData.push(l0,l1,l2,l3)
	sicTable.forEach(d => {
		_sicTable[d.ProductCode] = d.ProductDescription
	})
	buildChart(0, true, '')
})


function flattenStack(arr) {
	var flattened = []
	arr.forEach(d => {
		d.forEach(i => {
			flattened.push(i[0])
			flattened.push(i[1])
		})
	})

	return flattened
}


function parseData(data) {
	return data.map(d => Object.keys(d)
			.reduce((obj, key) => {
				obj[key] = isNaN(d[key]) ? d[key] : parseFloat(d[key])
				return obj
			}, {})
	)
}

function sortData(data) {
	return data.sort((a,b) => a.Year - b.Year)
}


function filterData(data, impFilter, aggFilter) { //impfilter = true gets only import data, false is export data
	var workingData = JSON.parse(JSON.stringify(data.filter(d => d.TradeFlowName == (impFilter ? 'Import' : 'Export'))))
	workingData.forEach(d => delete d.TradeFlowName); //dont need this anymore. we know what we gave it

	workingData = workingData.map(d => {
		return Object.keys(d) //https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
			.filter(key => key.substring(0, aggFilter.length) == aggFilter || key == 'Year')
			.reduce((obj, key) => {
				obj[key] = d[key]
				return obj
			}, {})
	})

	return workingData
}

function parseSortFilter(data, impFilter, aggFilter) {
	return filterData(sortData(parseData(data)), impFilter, aggFilter)
}


function validNextLayer(aggLevel, aggFilter) {
	return aggLevel < 3 && Object.keys(parseSortFilter(_aggData[aggLevel+1], true, aggFilter)[0]).length > 1
}


function buildChart(aggLevel, impFilter, aggFilter) {
	var margin = {top: 60, right: 250, bottom: 50, left: 70},
   	width = 1000 - margin.left - margin.right,
   	height = 400 - margin.top - margin.bottom;

	d3.selectAll("#chart > *").remove() //to reset the SVG

	var svg = d3.select("#chart")
  		.attr("width", width + margin.left + margin.right)
  		.attr("height", height + margin.top + margin.bottom)
  	.append("g")
  		.attr("transform",
  	   	"translate(" + margin.left + "," + margin.top + ")");


	var data = parseSortFilter(_aggData[aggLevel], impFilter, aggFilter)
	
	var keys = Object.keys(data[0]).filter(d => d != 'Year')

	var stack = d3.stack()
		.keys(keys)
		.offset(d3.stackOffsetNone)
		.order(d3.stackOrderReverse)

	var stack = stack(data)

	var color = d3.scaleOrdinal()
		.domain(keys)
		.range(d3.schemeTableau10)

	//ref: https://www.d3-graph-gallery.com/graph/stackedarea_template.html
	var x = d3.scaleLinear()
		.domain(d3.extent(data, d => d.Year))
		.range([0, width])
	
	var y = d3.scaleLinear()
		.domain([0, d3.max(flattenStack(stack))]) 
		.range([height, 0]);

	
	// Add a clipPath: everything out of this area won't be drawn.
	var clip = svg.append("defs").append("svg:clipPath")
      .attr("id", "clip")
      .append("svg:rect")
      .attr("width", width )
      .attr("height", height )
      .attr("x", 0)
      .attr("y", 0);

	// Add brushing
	//var brush = d3.brushX()                 // Add the brush feature using the d3.brush function
	//	.extent( [ [0,0], [width,height] ] ) // initialise the brush area: start at 0,0 and finishes at width,height: it means I select the whole graph area
	//	.on("end", updateChart)              // Each time the brush selection changes, trigger the 'updateChart' function

	// Create the scatter variable: where both the circles and the brush take place
	var areaChart = svg.append('g')
		.attr("clip-path", "url(#clip)")

	// Area generator
	var area = d3.area()
		.x(d => x(d.data.Year))
		.y0(d => y(d[0]))
		.y1(d => y(d[1]))

	// Show the areas
	areaChart.selectAll("mylayers")
		.data(stack)
		.enter()
		.append("path")
			.attr("class", d => "myArea" + (validNextLayer(aggLevel, d.key) ? ' pointer' : ''))
			.attr('id', d => 'area_'+d.key)
			.style("fill", d => color(d.key))
			.attr("d", area)
			//.attr('stroke-width', 0.5)
			//.attr('stroke', '#252525')
			.on('mouseover', (d, i) =>	highlight(d, i.key))
			.on('mouseout', (d, i) => noHighlight(d, i.key))
			.on('click', function(d, i) {
				if (validNextLayer(aggLevel, i.key)) {
					buildChart(aggLevel+1, impFilter, i.key)
				} 
			})
			.on('contextmenu', function(d, i) {
				d.preventDefault();
				if (aggLevel > 0) {
					buildChart(aggLevel-1, impFilter, i.key.substring(0,i.key.length-2))
				}
			})

	// Add the brushing
	//areaChart.append("g")
   //		.attr("class", "brush")
   //		.call(brush);

	var highlight = function(d, i){
		// reduce opacity of all groups
   	d3.selectAll(".myArea,.legendBox,.legendText").style("opacity", .25)
		// expect the one that is hovered
   	d3.selectAll("#area_"+i+',#legBox_'+i+',#legText_'+i).style("opacity", 1)
   }

   var noHighlight = function() {
   	d3.selectAll(".myArea,.legendBox,.legendText").style("opacity", 1)
   }


	 // Add one dot in the legend for each name.
   var size = 20
   svg.selectAll("myrect")
   	.data(keys)
   	.enter()
   	.append("rect")
   		.attr("x", width + margin.right/20)
   		.attr("y", (d,i) => 10 + i*(size+5)) // 100 is where the first dot appears. 25 is the distance between dots
   		.attr("width", size)
   		.attr("height", size)
			.attr('class', d => 'legendBox' + (validNextLayer(aggLevel, d) ? ' pointer' : ''))
			.attr('id', d => 'legBox_'+d)
   		.style("fill", d => color(d))
   		.on("mouseover", highlight)
   		.on("mouseleave", noHighlight)
			.on('click', function(d,i) {
				if (validNextLayer(aggLevel, i)) {
					buildChart(aggLevel+1, impFilter, i)
				}
			})
			.on('contextmenu', function(d, i) {
				d.preventDefault();
				if (aggLevel > 0) {
					buildChart(aggLevel-1, impFilter, i.substring(0,i.length-2))
				}
			})

   // Add one dot in the legend for each name.
   svg.selectAll("mylabels")
      .data(keys)
      .enter()
      .append("text")
      	.attr("x", width + margin.right/20 + size*1.2)
      	.attr("y", (d,i) => 10 + i*(size+5) + (size/2)) // 100 is where the first dot appears. 25 is the distance between dots
			.attr('class', d => 'legendText' + (validNextLayer(aggLevel, d) ? ' pointer' : ''))
			.attr('id', d => 'legText_'+d)
      	.style("fill", d => color(d))
      	.text(d => _sicTable[d])
      	.attr("text-anchor", "left")
      	.style("alignment-baseline", "middle")
      	.on("mouseover", highlight)
      	.on("mouseleave", noHighlight)
			.on('click', function(d,i) {
				if (validNextLayer(aggLevel, i)) {
					buildChart(aggLevel+1, impFilter, i)
				}
			})
			.on('contextmenu', function(d, i) {
				d.preventDefault();
				if (aggLevel > 0) {
					buildChart(aggLevel-1, impFilter, i.substring(0,i.length-2))
				} else {

				}
			})



	// AXES
	svg.append('g')
		.attr("transform", "translate(0," + height + ")")
		.call(d3.axisBottom(x))
	
	svg.append("text")
		.attr("text-anchor", "end")
		.attr("x", width)
		.attr("y", height+40 )
		.text("Time (year)");
	
	svg.append("g")
		.call(d3.axisLeft(y).ticks(7))
	
	svg.append("text")
		.attr("text-anchor", "end")
		.attr("x", -65)
		.attr("y", -20 )
		.text("Thousand Dollars")
		.attr("text-anchor", "start")
}
