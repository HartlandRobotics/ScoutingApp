'use strict';

let year = '2019';
let gscript_url = "https://script.google.com/macros/s/AKfycbw4RJ--QeKM905q6nn3zdeyJMCDh2L5vk0iHdQTxJVE8ecyHkcS/exec";
let ping_url = "https://script.google.com/macros/s/AKfycbwah-w_l3x1cfFUaljyUcwaif2Ks1aCl0AvM6p0ZdQIUZVDKfk/exec";

let comp_level_names = {
	"qm": "Qualification",
	"ef": "Octo-finals",
	"qf": "Quarterfinals",
	"sf": "Semifinals",
	"f": "Finals"
};
let comp_levels_play_order = {
	'qm': 1,
	'ef': 2,
	'qf': 3,
	'sf': 4,
	'f': 5
};

let match_counters = [
	{name: "\"\"\"Autonomous\"\"\"", style: "header"}, // gets big air quotes because its not really autonomous anymore
	{name: "Auto Hatch Panel", id:"auto_hatch", timer: "hatch_cycle"},
	{name: "Auto Cargo", id: "auto_cargo", timer: "cargo_cycle"},
	{name: "Auto Movement", id: "auto_movement", style: "dropdown", options: {"No Movement": 0, "Move off HAB 1": 1, "Move off HAB 2": 2}},

	{name: "Teleop", style: "header"},
	{name: "Hatch -> Ship", id: "hatch_ship", timer: "hatch_cycle"},
	{name: "Hatch -> Rocket", id: "hatch_rocket", timer: "hatch_cycle"},
	{name: "Cargo -> Ship", id: "cargo_ship", timer: "cargo_cycle"},
	{name: "Hatch Missed", id: "hatch_miss"},
	{name: "Cargo -> Rocket", id: "cargo_rocket", timer: "cargo_cycle"},
	{name: "Hatch Dropped", id: "hatch_drop"},
	{name: "Cargo Missed", id: "cargo_miss"},
	{name: "Cargo Dropped", id: "cargo_drop"},

	{name: "Endgame", style: "header"},
	{name: "Hab Zone", id: "hab_zone", style: "dropdown", options: {"No HAB": 0, "HAB Zone 1": 1, "HAB Zone 2": 2, "HAB Zone 3": 3}},
	{name: "Hab Zone Assistance", id: "hab_zone_assist"}
];

let data_queue = [];

window.addEventListener("load", () => {
	let new_data_queue = data_queue;
	if(localStorage.getItem("data_queue"))
		new_data_queue = JSON.parse(localStorage.getItem("data_queue"));
	accordion(document.getElementById('screen-event'));

	open_screen("");
	document.body.classList.add("loading");
	get_jsonp(gscript_url + "?random=" + Math.random()).then(() => {
		data_queue = new_data_queue;
		open_screen("events");
	}, () => {
		get_jsonp(ping_url + "?random=" + Math.random()).then(() => {
			window.location.href = gscript_url + "?redirect=" + encodeURIComponent(window.location.href);
		}, () => {
			data_queue = new_data_queue;
			open_screen("events");
		});
	});

	document.body.addEventListener("touchend", (e) => {
		var t2 = e.timeStamp;
		var t1 = e.currentTarget.dataset.lastTouch || t2;
		var dt = t2 - t1;
		var fingers = e.touches.length;
		e.currentTarget.dataset.lastTouch = t2;

		if (!dt || dt > 500 || fingers > 1) return; // not double-tap

		e.preventDefault();
		e.target.click();
	});
});

window.addEventListener("beforeunload", () => {
	if(data_queue_processing)
		return "The data is still being uploaded!";
}, false);

window.back = function back() {
	if(window.curr_screen == "event")
		open_screen("events");
	else if(window.curr_screen == "match" || window.curr_screen == "team")
		open_screen("event", window.event_meta);
	else if(window.curr_screen == "enterdata")
		open_screen("match", window.match_meta);
};

async function open_screen(screenname, meta = {}) {
	for(let n of ['events', 'event', 'match', 'team', 'error', 'enterdata']) {
		let elem = document.getElementById('screen-'+n);
		elem.style.display = (n == screenname) ? 'block' : 'none';
		if(n == screenname) {
			for(let section of elem.children) {
				if(!section.classList.contains('section'))
					continue;
				section.classList.remove("section-selected");
			}
		}
		window.curr_screen = screenname;
	}
	try {
		if(screenname == 'events') {
			let list = document.getElementById('event-list');
			list.innerHTML = "";
			document.body.classList.add("loading");
			let events = await get_events();
			let events_obj = {};
			for(let item of events) {
				let elem = document.createElement('div');
				elem.classList.add('list-item');
				elem.innerText = (item.week != null ? 'Week ' + item.week + ': ' : '') + item.name + ' (' + item.key + ') ';
				list.appendChild(elem);
				elem.addEventListener("click", () => {
					open_screen("event", {event: item.key, name: item.name});
				});
				events_obj[item.key] = item;
			}
			document.body.classList.remove("loading");
		} else if(screenname == 'event') {
			window.event_meta = meta;
			document.body.classList.add("loading");
			document.getElementById("event-label").textContent = meta.name;

			let {teams, matches} = await get_event_meta(meta.event);

			document.body.classList.remove("loading");
			let team_list = document.getElementById('event-teams-list');
			team_list.innerHTML = "";
			for(let team of teams) {
				let elem = document.createElement('div');
				elem.classList.add('list-item');
				elem.innerText = '(' + team.team_number + ') ' + team.nickname;
				elem.addEventListener("click", () => {
					open_screen("team", {team: team.key, name: team.nickname});
				});
				team_list.appendChild(elem);
			}

			let match_list = document.getElementById('event-match-list');
			match_list.innerHTML = "";
			let match_elems = {};
			for(let match of matches) {
				let elem = document.createElement('div');
				elem.classList.add('list-item');
				let name = match_name(match);
				elem.innerText = name;
				elem.addEventListener("click", () => {
					open_screen("match", {match: match.key, name});
				});
				match_elems[match.key] = elem;
				match_list.appendChild(elem);
			}
			get_jsonp(gscript_url + "?get_scouted=" + encodeURIComponent(meta.event)).then((scouted_list) => {
				for(let match of Object.keys(match_elems)) {
					let elem = match_elems[match];
					if(!scouted_list[match])
						elem.classList.add("not-scouted");
					else if(scouted_list[match].length < 6)
						elem.classList.add("partially-scouted");
					else
						elem.classList.add("fully-scouted");
				}
			}, (err)=>{console.error(err);});
		} else if(screenname == 'match') {
			window.match_meta = meta;

			document.body.classList.add("loading");
			document.getElementById("match-label").textContent = meta.name;
			let match = await get_match(meta.match);
			document.body.classList.remove("loading");

			console.log(match);

			let match_teams = document.getElementById('match_teams');
			match_teams.innerHTML = "";
			let team_elems = {};
			for(let alliance_name of ['red', 'blue']) {
				let alliance = match.alliances[alliance_name];
				for(let team of alliance.team_keys) {
					let elem = document.createElement('div');
					elem.classList.add("alliance-team", alliance_name);
					elem.textContent = team.substring(3);
					team_elems[team] = elem;
					match_teams.appendChild(elem);
					elem.addEventListener("click", () => {
						open_screen("enterdata", {match: meta.match, team, match_name: meta.name});
					});
				}
			}
			get_jsonp(gscript_url + "?get_scouted=" + encodeURIComponent(meta.match)).then((scouted_list) => {
				let match_scouted;
				for(match_scouted of Object.keys(scouted_list)) {
					match_scouted = scouted_list[match_scouted];
					break;
				}
				if(!match_scouted) match_scouted = [];
				for(let team of Object.keys(team_elems)) {
					let elem = team_elems[team];
					if(match_scouted.indexOf(team) != -1) elem.classList.add("scouted");
					else elem.classList.add("not-scouted");
				}
			}, (err)=>{console.error(err);});
		} else if(screenname == 'team') {
			window.team_meta = meta;
			document.body.classList.add("loading");
			let match_list = document.getElementById('team-matches');
			match_list.innerHTML = "";
			let match_elems = {};
			for(let match of (await get_event_meta(window.event_meta.event)).matches) {
				if(match.alliances && ((match.alliances.red && match.alliances.red.team_keys && match.alliances.red.team_keys.indexOf(meta.team) != -1) || (match.alliances.blue && match.alliances.blue.team_keys && match.alliances.blue.team_keys.indexOf(meta.team) != -1))) {
					let elem = document.createElement('div');
					elem.classList.add('list-item');
					let name = match_name(match);
					elem.innerText = name;
					elem.addEventListener("click", () => {
						open_screen("match", {match: match.key, name});
					});
					match_elems[match.key] = elem;
					match_list.appendChild(elem);
				}
			}
			get_jsonp(gscript_url + "?get_scouted=" + encodeURIComponent(window.event_meta.event)).then((scouted_list) => {
				for(let match of Object.keys(match_elems)) {
					let elem = match_elems[match];
					if(!scouted_list[match] || !scouted_list[match].includes(meta.team))
						elem.classList.add("not-scouted");
					else
						elem.classList.add("fully-scouted");
				}
			}, (err)=>{console.error(err);});
			document.getElementById("team-label").textContent = meta.name + " (" + meta.team + ")";
			document.body.classList.remove("loading");
		} else if(screenname == 'enterdata') {
			window.enterdata_meta = meta;
			document.getElementById('match-comments').value = "";
			document.getElementById('enterdata-team-match').textContent = meta.match_name + " (" + meta.team + ")";
			let counters = document.getElementById('counters');
			counters.innerHTML = "";
			window.counter_nums = {};
			window.counter_timers = {};
			for(let counter of match_counters) {
				if(counter.style == "header") {
					let elem = document.createElement("h2");
					elem.textContent = counter.name;
					counters.appendChild(elem);
					continue;
				}
				let elem = document.createElement("div");
				elem.classList.add("counter");

				let label = document.createElement("div");
				label.classList.add("label");
				label.textContent = counter.name;
				elem.appendChild(label);

				if(counter.style == "dropdown") {
					elem.classList.add("counter-dropdown");
					let select = document.createElement("select");
					for(let option_name of Object.keys(counter.options)) {
						let option_value = counter.options[option_name];
						if(window.counter_nums[counter.id] == undefined)
							window.counter_nums[counter.id] = option_value;
						let option = document.createElement("option");
						option.value = option_value;
						option.textContent = option_name;
						select.appendChild(option);
					}
					select.addEventListener("change", () => {
						if(("" + +select.value) === select.value)
							window.counter_nums[counter.id] = +select.value;
						else
							window.counter_nums[counter.id] = select.value;
					});
					elem.appendChild(select);
				} else {
					let subtractor = document.createElement("div");
					subtractor.classList.add("minus");
					subtractor.addEventListener("click", ()=>{
						if(window.counter_nums[counter.id] <= 0)
							return;
						window.counter_nums[counter.id]--;
						number.textContent = ""+window.counter_nums[counter.id];
						window.counter_timers[counter.id].length = window.counter_nums[counter.id];
					});
					elem.appendChild(subtractor);

					let number = document.createElement("div");
					number.classList.add("number");
					number.textContent = "0";
					elem.appendChild(number);

					let adder = document.createElement("div");
					adder.classList.add("plus");
					adder.addEventListener("click", ()=>{
						if(counter.max && window.counter_nums[counter.id] >= counter.max)
							return;
						window.counter_nums[counter.id]++;
						number.textContent = ""+window.counter_nums[counter.id];
						window.counter_timers[counter.id].length = window.counter_nums[counter.id];
						window.counter_timers[counter.id][window.counter_nums[counter.id]-1] = performance.now();
					});
					elem.appendChild(adder);
					window.counter_nums[counter.id] = 0;
					window.counter_timers[counter.id] = [];
				}

				counters.appendChild(elem);
			}
		}
	} catch(e) {
		console.error(e);
		document.body.classList.remove("loading");
		if(screenname != 'error') {
			open_screen('error');
		}
	}
	process_queue();
}
window.open_match_in_tba = function open_match_in_tba() {
	window.open("https://www.thebluealliance.com/match/"+window.match_meta.match, "_blank");
};

window.open_team_in_tba = function open_team_in_tba() {
	window.open("https://www.thebluealliance.com/"+window.team_meta.team, "_blank");
};

window.open_event_in_tba = function open_event_in_tba() {
	window.open("https://www.thebluealliance.com/"+window.event_meta.event, "_blank");
};

function match_name(match) {
	return comp_level_names[match.comp_level] + (match.comp_level == "qm" ? "" : ' Set ' + match.set_number + ' Match ') + ' ' + match.match_number;
}

async function get_events() {
	try {
		let events = JSON.parse(await get_tba('https://www.thebluealliance.com/api/v3/events/'+year));
		events.sort((a, b) => {
			let afimscore = (a.district && a.district.abbreviation == "fim") ? 0 : 1;
			let bfimscore = (b.district && b.district.abbreviation == "fim") ? 0 : 1;
			if(afimscore != bfimscore)
				return afimscore - bfimscore;

			let adist = (a.district && a.district.abbreviation) || "zzz";
			let bdist = (b.district && b.district.abbreviation) || "zzz";
			if(adist < bdist) return -1;
			if(adist > bdist) return 1;

			let aweek = a.week != null ? a.week : 100;
			let bweek = b.week != null ? b.week : 100;
			if(aweek != bweek)
				return aweek - bweek;

			if(a.name < b.name) return -1;
			if(a.name > b.name) return 1;
			return 0;
		});
		localStorage.setItem("events", JSON.stringify(events));
		return events;
	} catch(e) {
		let cached = localStorage.getItem("events");
		if(cached)
			return JSON.parse(cached);
		throw e;
	}
}

async function get_event_meta(event_key) {
	try {
		let [teams_str, matches_str] = await Promise.all([
			get_tba('https://www.thebluealliance.com/api/v3/event/' + event_key + '/teams'),
			get_tba('https://www.thebluealliance.com/api/v3/event/' + event_key + '/matches')
		]);
		let teams = JSON.parse(teams_str);
		let matches = JSON.parse(matches_str);

		for(let match of matches) {
			delete match.score_breakdown; // Let's not store a crapton of data on the client's computer that they probably won't need
		}

		matches.sort((a, b) => {
			let ao = comp_levels_play_order[a.comp_level];
			let bo = comp_levels_play_order[b.comp_level];
			if(ao != bo)
				return ao - bo;
			if(a.match_number != b.match_number)
				return a.match_number - b.match_number;
			return a.set_number - b.set_number;
		});

		teams.sort((a, b) => {return a.team_number - b.team_number;});

		let obj = {teams, matches};
		localStorage.setItem("event_" + event_key, JSON.stringify(obj));
		return obj;
	} catch(e) {
		let cached = localStorage.getItem("event_" + event_key);
		if(cached)
			return JSON.parse(cached);
		throw e;
	}
}

async function get_match(match_key) {
	try {
		return JSON.parse(await get_tba('https://www.thebluealliance.com/api/v3/match/' + match_key));
	} catch(e) {
		let event_key = match_key.match(/([0-9]{4}[a-z0-9]+)_/i)[1];
		let cached_event = localStorage.getItem("event_" + event_key);
		if(!cached_event)
			throw e;
		cached_event = JSON.parse(cached_event);
		for(let match of cached_event.matches) {
			if(match.key == match_key)
				return match;
		}
		throw e;
	}
}

function get_tba(url) {
	return new Promise((resolve, reject) => {
		let treq = new XMLHttpRequest();
		treq.open('GET', url);
		treq.setRequestHeader('X-TBA-Auth-Key', 'vs7BmpAkLE7z5toYjRcpHtLHsE8vmS16ImhnEc059xZyLTt6Yg1wbP3xhMEQQGi2');
		treq.addEventListener("load", () => {
			resolve(treq.responseText);
		});
		treq.addEventListener("error", (err) => {
			reject(err);
		});
		treq.send();
	});
}

window.submit_data = function submit_data() {
	let url = gscript_url + "?submit=1";
	let obj = {
		notes: document.getElementById('match-comments').value,
		match: window.enterdata_meta.match,
		team: window.enterdata_meta.team
	};
	for(let key of Object.keys(window.counter_nums)) {
		obj["counter-" + key] = window.counter_nums[key];
	}
	let timers = {};
	for(let meta of match_counters) {
		if(meta.style)
			continue;
		let key = meta.id;
		if(meta.timer) {
			timers[meta.timer] = timers[meta.timer] || [];
			if(window.counter_timers[key])
				for(let time of window.counter_timers[key])
					timers[meta.timer].push(time);
		}
	}
	for(let key of Object.keys(timers)) {
		let timer = timers[key];
		timer.sort((a,b) => {return a-b;});
		let min_cycle = Infinity;
		for(let i = 0; i < timer.length-1; i++) {
			let this_cycle = timer[i+1] - timer[i];
			if(this_cycle > 3000)
				min_cycle = Math.min(min_cycle, this_cycle);
		}
		obj["counter-" + key] = min_cycle;
	}
	for(let key of Object.keys(obj)) {
		url += "&" + key + "=" + encodeURIComponent(obj[key]);
	}
	// We have our URL! Now let's stop making the user wait.
	open_screen("event", window.event_meta);
	data_queue.push(url);
	process_queue();
	localStorage.setItem("data_queue", JSON.stringify(data_queue));
};

let data_queue_processing = false;

async function process_queue() {
	if(data_queue_processing)
		return false;
	try {
		data_queue_processing = true;
		while(data_queue.length) {
			let item = data_queue[0];
			console.log(`Uploading ${item}...`);
			await get_jsonp(item);
			console.log(`Upload of ${item} successful!`);
			// success!
			data_queue.splice(0, 1);
			localStorage.setItem("data_queue", JSON.stringify(data_queue));
		}
	} finally {
		data_queue_processing = false;
	}
}

let jsonp_counter = 0;
function get_jsonp(url) {
	return new Promise((resolve, reject) => {
		jsonp_counter++;
		let funcname = "jsonp_callback_" + jsonp_counter;
		let script_elem = document.createElement("script");
		let done = false;
		window[funcname] = (result) => {
			delete window[funcname];
			document.head.removeChild(script_elem);
			done = true;
			resolve(result);
		};
		script_elem.src = url + (url.indexOf("?") == -1 ? "?" : "&") + "callback=" + funcname;
		script_elem.addEventListener("error", () => {
			delete window[funcname];
			document.head.removeChild(script_elem);
			done = true;
			reject(new Error("JSONP request to " + url + " failed"));
		});
		script_elem.addEventListener("load", () => {
			setTimeout(() => {
				if(!done) {
					reject(new Error(`JSONP request blocked by CORB`));
				}
			}, 300);
		});
		document.head.appendChild(script_elem);
	});
}

function accordion(base_elem) {
	for(let section of base_elem.children) {
		if(!section.classList.contains('section'))
			continue;
		let label = section.getElementsByClassName('section-label')[0];
		label.addEventListener("click", () => {
			for(let item of base_elem.children) {
				if(item == section && !item.classList.contains('section-selected')) {
					item.classList.add('section-selected');
				} else {
					item.classList.remove('section-selected');
				}
			}
		});
	}
}
