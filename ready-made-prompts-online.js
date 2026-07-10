(function () {
    'use strict';

    const prompt = (id, text, options = {}) => ({
        id,
        text,
        badge: options.badge || 'all',
        audiences: options.audiences || [],
        tags: options.tags || [],
        capabilities: options.capabilities || ['decision'],
        outputType: options.outputType || 'answer',
        followups: options.followups || [],
        action: options.action || 'use',
        ownerSafetyReview: Boolean(options.ownerSafetyReview)
    });

    const advanced = (id, text, options = {}) => prompt(id, text, { ...options, badge: 'advanced' });
    const image = (id, text, options = {}) => prompt(id, text, {
        ...options,
        badge: 'vision',
        capabilities: ['image', ...(options.capabilities || ['decision'])],
        action: 'image'
    });
    const video = (id, text, options = {}) => prompt(id, text, {
        ...options,
        badge: 'video',
        capabilities: ['video', ...(options.capabilities || ['decision'])],
        action: 'video'
    });
    const visual = (id, text, options = {}) => advanced(id, text, {
        ...options,
        capabilities: ['visual', ...(options.capabilities || ['decision'])],
        outputType: 'visual',
        followups: ['Create Visual'],
        action: 'visual'
    });
    const guide = (id, text, options = {}) => advanced(id, text, {
        ...options,
        capabilities: ['field-guide', ...(options.capabilities || ['decision'])],
        outputType: 'field-guide',
        followups: ['Make Field Guide', 'Save PDF'],
        action: 'field-guide'
    });

    const category = (id, icon, title, description, audiences, prompts, subcategory = 'Scenario Prompts') => ({
        id,
        icon,
        title,
        description,
        audiences,
        subcategories: [{ title: subcategory, prompts }]
    });

    const categories = [
        category('emergency-now', '🚨', 'Emergency Now', 'Priority-first decisions when time, power, travel, or communications are limited.', ['emergency', 'prepper', 'rural'], [
            advanced('wildfire-go-10-minutes', 'A wildfire evacuation warning just changed to GO. I have 10 minutes, two adults, one child, one dog, one car, and these items already packed: [list]. Give me a minute-by-minute priority plan, what to leave behind, and the trigger to depart immediately.', { tags: ['wildfire', 'evacuation', 'ten minutes'], followups: ['Make Field Guide'] }),
            advanced('outage-food-triage', 'Power has been out for 18 hours. My refrigerator is 46°F, freezer is 28°F, outside temperature is 92°F, and I have one cooler plus 10 pounds of ice. Sort my food into use now, move to cooler, or discard, then plan the next 24 hours.', { tags: ['blackout', 'food safety', 'cooler'], followups: ['Make Field Guide'] }),
            advanced('earthquake-first-30', 'A strong earthquake just stopped. I am at home with [people/pets], utilities may be damaged, and aftershocks are possible. Give me a priority-ordered plan for the first 30 minutes, including what not to touch and when to leave the building.', { tags: ['earthquake', 'aftershock', 'utilities'] }),
            advanced('flash-flood-camp', 'A flash-flood warning was issued for my area and I am camped near a dry wash. It is dark, rain is upstream, and I have one vehicle. Tell me the single most important action first, then give me a safe relocation checklist and terrain features to avoid.', { tags: ['flash flood', 'dry wash', 'camp'] }),
            advanced('winter-outage-home', 'A winter storm has cut power to my rural home. Indoor temperature is 52°F and falling, roads may be closed for 24 hours, and I have [heat sources/fuel]. Decide whether I should stay, consolidate into one room, or leave, with clear reassessment triggers.', { tags: ['winter storm', 'cold', 'power outage'] }),
            advanced('wildfire-smoke-shelter', 'Wildfire smoke is heavy, the evacuation zone has not reached me, and one family member has breathing problems. Compare sheltering indoors versus leaving now using smoke, traffic, route, and indoor-air conditions; give me decision triggers rather than general advice.', { tags: ['smoke', 'air quality', 'evacuation'] }),
            advanced('boil-notice-no-power', 'A boil-water notice was issued during a power outage. I have tap water, bottled water, a propane camp stove, bleach labeled [strength], and containers. Prioritize which water to reserve and create a 48-hour treatment and storage plan with clear safety limits.', { tags: ['boil notice', 'water', 'power outage'] }),
            advanced('storm-damaged-roof', 'A storm damaged part of my roof and more rain is expected in three hours. I have tarps, rope, buckets, and basic tools. Separate what I should do from the ground right now, what can wait, and what is too dangerous to attempt.', { tags: ['roof', 'storm', 'temporary repair'] }),
            advanced('separated-family-disaster', 'My family is separated after a regional emergency: two adults at work, one child at school, roads are partially blocked, and cell service is unreliable. Give me a priority plan for the next two hours using preselected contacts and meeting places.', { tags: ['family', 'communications', 'roads blocked'] }),
            advanced('vehicle-stranded-heat', 'My vehicle is disabled on a remote road, outside temperature is 105°F, I have [water amount], shade is limited, and there is no cell signal. Decide whether I should stay with the vehicle or move, then give me hourly water, shade, and signaling priorities.', { tags: ['vehicle', 'heat', 'stranded'] }),
            advanced('tornado-warning-rural', 'A tornado warning covers my rural property. I have no basement, two adults, pets, and several outbuildings. Rank the safest available shelter locations, tell me what to bring in the next three minutes, and what not to delay for.', { tags: ['tornado', 'shelter', 'rural home'] }),
            advanced('emergency-priority-assessment', 'I am dealing with this emergency: [describe situation]. My people, location, weather, time, communications, gear, and injuries are: [details]. Put the single most important action first, then give me Now / Next / Later steps and explicit stop or evacuate conditions.', { tags: ['priority first', 'triage', 'decision template'] })
        ]),

        category('preparedness-family', '🎒', 'Prepping & Family Readiness', 'Plans, inventories, drills, and affordable readiness improvements before an emergency.', ['prepper', 'emergency', 'family'], [
            advanced('seven-day-readiness-audit', 'Audit my seven-day emergency readiness for [number of people], [pets], and [climate]. Here is what I own: [inventory]. Rank the five most important gaps by risk reduction, cost, and how quickly I can fix them.', { tags: ['inventory', 'gap analysis', 'seven day'] }),
            guide('no-cell-family-plan', 'Build a no-cell family communication plan for two adults at separate workplaces and a child at school. Include two meeting locations, an out-of-area contact, written wallet-card instructions, and what changes if roads are blocked.', { tags: ['communications', 'wallet card', 'family'] }),
            advanced('three-day-kit-fit', 'Create a three-day emergency kit for [people/pets] in [climate] with a maximum budget of [$] and maximum carry weight of [weight]. Separate must-have items from upgrades and explain the risk each item addresses.', { tags: ['72 hour kit', 'budget', 'weight'] }),
            advanced('evacuation-route-comparison', 'Compare my three evacuation routes using distance, choke points, bridges, wildfire or flood exposure, fuel stops, and backup destinations. Tell me which route should be primary and the exact conditions that switch me to another.', { tags: ['evacuation route', 'decision', 'map'] }),
            advanced('blackout-room-plan', 'Plan one safe room for a 72-hour blackout in [season]. I have [lighting, batteries, heat/cooling, water, cooking gear]. Prioritize ventilation, temperature control, sanitation, lighting, and charging without assuming I can buy anything.', { tags: ['blackout', 'safe room', '72 hours'] }),
            advanced('pet-evacuation-plan', 'Create an evacuation plan for [pets/livestock] with one vehicle and [number] minutes to leave. Include carriers or restraints, water, records, destinations, loading order, and what to do if an animal will not cooperate.', { tags: ['pets', 'livestock', 'evacuation'] }),
            advanced('preparedness-monthly-budget', 'I can spend [$] per month on preparedness for six months. My biggest risks are [hazards]. Build a month-by-month buying and practice plan that fixes the highest-consequence gaps first and avoids duplicate gear.', { tags: ['budget', 'six month plan', 'priorities'] }),
            advanced('neighborhood-response-roles', 'Design a simple neighborhood emergency plan for [number] households with mixed ages and skills. Assign communication, wellness check, first-aid, utility, shelter, and supply roles without collecting unnecessary private information.', { tags: ['neighborhood', 'roles', 'mutual aid'] }),
            guide('document-grab-list', 'Make a one-page grab list for critical documents, medications, contacts, pet records, insurance details, and offline maps. Separate originals, encrypted digital copies, and information that should never be left unsecured.', { tags: ['documents', 'grab list', 'offline copies'] }),
            advanced('drill-after-action', 'Here is what happened during our emergency drill: [timeline and problems]. Turn it into an after-action review with what worked, what failed, the three most important fixes, an owner for each fix, and a retest date.', { tags: ['drill', 'after action', 'improvement'] })
        ]),

        category('water-food-shelter-fire', '💧', 'Water, Food, Shelter & Fire', 'Core field needs with conditions, constraints, and clear safety limits.', ['prepper', 'hiker', 'camper', 'homestead'], [
            advanced('desert-stream-water', 'I found a slow desert stream after recent livestock activity. I have a filter rated to 0.1 micron, a metal pot, chlorine-dioxide tablets, and two bottles. Build a treatment sequence, explain what each step does not remove, and identify safer alternatives.', { tags: ['desert', 'stream', 'purification'] }),
            advanced('silty-filter-trickle', 'My squeeze water filter dropped from one liter per minute to a trickle after filtering silty water. I have clean water, a bottle, and no backflush syringe. Give me the lowest-risk diagnostic sequence and tell me when to stop using it.', { tags: ['water filter', 'silt', 'field repair'] }),
            advanced('water-inventory-ration', 'We have [gallons] of potable water for [people/pets] and the outage may last [days]. Build a daily allocation for drinking, food, hygiene, and animals; identify the first conservation steps and the point where we must find another source.', { tags: ['water storage', 'rationing', 'outage'] }),
            advanced('rainwater-first-flush', 'Rain is starting after 60 dry days and I want to collect roof runoff. My roof and gutters are [materials/condition]. Decide what to discard, how to separate first-flush water, and what treatment is required for drinking versus cleaning.', { tags: ['rainwater', 'first flush', 'roof'] }),
            guide('stored-water-rotation', 'Create a phone-friendly rotation guide for [container type and volume] emergency water stored in [temperature/light conditions]. Include inspection, cleaning, labeling, replacement triggers, and what to do after a container seal fails.', { tags: ['stored water', 'rotation', 'containers'] }),
            advanced('tarp-shelter-cold-rain', 'I need an overnight tarp shelter in 38°F rain with 20 mph wind. I have an 8x10 tarp, 50 feet of cord, one groundsheet, and trees [distance] apart. Choose a shelter configuration and prioritize drainage, wind direction, insulation, and ventilation.', { tags: ['tarp shelter', 'cold rain', 'wind'] }),
            advanced('cold-ground-insulation', 'I have a sleeping bag rated to 20°F but no sleeping pad, and the ground is wet and near freezing. Rank the safest insulation materials available around camp and show how to build enough separation without damaging live vegetation.', { tags: ['ground insulation', 'cold', 'sleep'] }),
            advanced('wet-weather-fire-sequence', 'Everything is damp after two days of rain. I have one lighter, a knife, cotton cloth, and access to standing dead wood. Give me a fuel-gathering and fire-building sequence that conserves ignition attempts and includes a no-fire fallback.', { tags: ['wet fire', 'tinder', 'rain'] }),
            advanced('camp-stove-fuel-budget', 'I have [fuel type and amount] for [people] over [days] in [temperature/wind]. Estimate how many boils or meals it supports, then redesign my cooking plan to preserve an emergency reserve.', { tags: ['stove', 'fuel', 'meal plan'] }),
            advanced('seven-day-pantry-meals', 'Build a seven-day meal plan for [people] using only this shelf-stable inventory: [list]. Minimize fuel, water, dishes, and food waste while meeting reasonable calories and rotating the most perishable items first.', { tags: ['pantry', 'meal plan', 'fuel'] }),
            advanced('harvest-preservation-triage', 'I harvested [produce/meat] but power is unreliable and daytime temperature is [temperature]. Compare eat now, dehydrate, ferment, can, smoke, freeze, or discard; prioritize by time-to-spoilage and equipment I actually have.', { tags: ['preservation', 'harvest', 'power outage'] }),
            advanced('solar-still-reality-check', 'I am considering a solar still for emergency water in [terrain and weather]. Estimate realistic yield, energy cost, and contamination limits, then compare it with collecting, filtering, boiling, or signaling for rescue.', { tags: ['solar still', 'water yield', 'decision'] }),
            prompt('char-cloth-small-batch', 'I have a small metal tin, cotton fabric, a safe outdoor fire area, and one attempt. Give me a small-batch char-cloth process, the visual signs of success, and how to test it without wasting the whole batch.', { tags: ['char cloth', 'fire starting'] }),
            prompt('indoor-cooking-no-power', 'What is the best way to cook indoors without power safely', { tags: ['indoor cooking', 'blackout'], ownerSafetyReview: true })
        ]),

        category('hiking-backcountry', '🥾', 'Hiking, Hunting & Backcountry', 'Route, weather, gear, wildlife, and return-or-continue decisions away from immediate help.', ['hiker', 'hunter', 'emergency'], [
            advanced('sunset-route-decision', 'Sunset is in 2 hours 15 minutes. I am six miles from the trailhead with 1.5 liters of water, temperature is falling, and clouds are building. Compare continue, turn back, or shelter here; recommend one and give me decision checkpoints.', { tags: ['sunset', 'turn around', 'route'] }),
            advanced('lost-gps-dead', 'My GPS and phone are dead. I last knew my position at [landmark/time], the trail generally runs [direction], terrain is [type], and weather is [conditions]. Tell me whether to stay put or navigate, then give me a conservative reorientation plan.', { tags: ['lost', 'GPS', 'navigation'] }),
            advanced('water-resupply-choice', 'I have [water] left and two possible water sources: one is [distance/elevation/reliability], the other is [details]. Compare the routes using daylight, treatment options, heat, and the cost of being wrong.', { tags: ['water source', 'route choice', 'daylight'] }),
            advanced('weather-turnaround-rule', 'The forecast says [conditions], clouds now look [description], wind changed from [direction/speed], and I am [distance/time] from shelter. Create a turn-around rule with observable triggers I can use without cell service.', { tags: ['weather', 'turnaround', 'forecast'] }),
            advanced('pack-weight-risk-audit', 'Audit my pack list for a [days]-day trip in [season/terrain]. Remove redundant weight, identify missing safety-critical items, and explain which items solve the same failure mode.', { tags: ['pack list', 'weight', 'gear'] }),
            advanced('blister-hotspot-plan', 'I have a developing heel hot spot, [distance] miles remaining, dry socks, tape, and basic first-aid supplies. Give me a stop-now treatment, footwear adjustment, and criteria for ending the hike before it becomes a disabling blister.', { tags: ['blister', 'feet', 'first aid'] }),
            advanced('wildlife-encounter-plan', 'I am traveling through [bear/cougar/boar] habitat with [group size, food, pets]. Build a prevention and encounter plan for camp, trail, and night, using region-appropriate non-escalation steps.', { tags: ['wildlife', 'encounter', 'prevention'] }),
            advanced('warm-weather-game-care', 'Create a safe field plan for handling harvested game in [temperature] weather when the vehicle is [time] away. Prioritize cooling, cleanliness, airflow, transport, and discard warning signs.', { tags: ['hunting', 'game care', 'warm weather'] }),
            advanced('backcountry-meal-weight', 'Create a three-day backpacking meal plan for [body size/activity] using [diet limits]. Show calories, protein, water needed, fuel use, and packed weight, then identify the best emergency reserve food.', { tags: ['meals', 'calories', 'pack weight'] }),
            guide('no-phone-signaling', 'Make a one-page field guide for signaling without a phone in forest, desert, and mountain terrain. Include visual, audible, ground-to-air, nighttime, and stay-with-vehicle options plus signals that may be misunderstood.', { tags: ['signaling', 'no phone', 'rescue'] })
        ]),

        category('camping-overlanding', '🏕️', 'Camping & Overlanding', 'Campsite selection, weatherproofing, food, sanitation, recovery, and camp security.', ['camper', 'overlander', 'hiker'], [
            image('campsite-photo-hazards', 'Use these campsite photos to check for dead limbs, drainage problems, wind exposure, animal signs, unstable ground, and escape routes. Rank each hazard and tell me whether to move camp or modify the site.', { tags: ['campsite', 'hazard', 'photo'], followups: ['Create Visual'] }),
            video('tarp-wind-video', 'Analyze this 20-second video of my tarp in gusty wind. Identify which tie-outs are loading unevenly, what is likely to fail first, and give me the safest adjustment order.', { tags: ['tarp', 'wind', 'tie-outs'], followups: ['Create Visual'] }),
            advanced('forty-mph-camp', 'Wind may reach 40 mph tonight. I have two tarps, six stakes, 100 feet of rope, a vehicle, and rocky ground. Design three camp-securing options, rank them by reliability, and identify what should be taken down before the wind arrives.', { tags: ['high wind', 'rope', 'tarps'] }),
            advanced('flash-rain-drainage', 'Heavy rain may begin in 45 minutes. My tent is on a slight slope with compacted soil and runoff from higher ground. Give me three Leave No Trace ways to redirect water, protect sleeping gear, and decide whether moving is safer.', { tags: ['rain', 'drainage', 'tent'] }),
            advanced('cooler-food-order', 'I have one small cooler, [ice amount], daytime temperature [temperature], and these foods: [list]. Set the packing order, opening schedule, meal order, and discard rules for a [days]-day camp.', { tags: ['cooler', 'food', 'camp cooking'] }),
            advanced('camp-wildlife-barrier', 'Wildlife has approached camp twice. I have a vehicle, lights, cord, cookware, and food containers. Build a non-lethal prevention plan for food storage, cooking location, waste, noise, and nighttime response.', { tags: ['wildlife', 'camp security', 'food storage'] }),
            guide('camp-departure-check', 'Make a fast camp-departure checklist for weather changes or evacuation. Include people, pets, fire, fuel, trash, food, shelter, vehicle, route, and a final 60-second sweep.', { tags: ['departure', 'checklist', 'evacuation'] }),
            advanced('family-camp-layout', 'Design a safe camp layout for two adults, two children, and a dog near [water/road/forest]. Separate sleeping, cooking, fire, food storage, sanitation, vehicle, and emergency-exit zones.', { tags: ['family camp', 'layout', 'safety'], followups: ['Create Visual'] }),
            advanced('extended-camp-sanitation', 'Plan sanitation for [people] at a seven-day dispersed camp with no toilets and limited water. Account for handwashing, dishwater, human waste, trash, animals, weather, and local restrictions.', { tags: ['sanitation', 'dispersed camp', 'seven days'] }),
            advanced('stuck-vehicle-recovery-decision', 'My vehicle is stuck in [sand/mud/snow], I have [traction gear/tools], daylight remaining is [time], and help is [distance]. Decide whether to self-recover, wait, or walk; give me a safe attempt limit.', { tags: ['vehicle recovery', 'stuck', 'decision'] })
        ]),

        category('van-rv', '🚐', 'Van Life & RV', 'Battery, water, refrigeration, leaks, condensation, parking, and trip resilience.', ['van-rv', 'overlander', 'camper'], [
            advanced('van-overnight-battery', 'My van house battery reads 12.7 volts at sunset and 11.9 by morning with only the refrigerator and roof fan running. Solar produced 420 Wh yesterday. Build a prioritized load-versus-charging diagnosis using only readings I can safely take.', { tags: ['battery', 'solar', 'overnight'] }),
            video('rv-ceiling-leak-video', 'Analyze this video of an RV ceiling leak during rain. Trace the most likely entry points from the water path and timing, tell me what to photograph next, and separate emergency containment from permanent repair.', { tags: ['RV leak', 'rain', 'roof'], followups: ['Make Field Guide'] }),
            advanced('rv-water-pump-cycle', 'My RV water pump runs for two seconds every few minutes when every faucet is closed. Give me a no-disassembly test sequence to distinguish a leak, pressure loss, check-valve problem, or sensor issue.', { tags: ['water pump', 'leak', 'RV'] }),
            advanced('rv-fridge-hot-weather', 'My RV refrigerator rises to 50°F only while boondocking in 95°F weather. The RV is level and exterior vents look clear. Separate food-safety actions from safe airflow, power-source, loading, and maintenance checks.', { tags: ['refrigerator', 'boondocking', 'hot weather'] }),
            advanced('van-condensation-plan', 'Windows and metal panels drip overnight when two people sleep in the van at 35°F. I have a roof vent, window covers, and limited battery. Balance ventilation, heat retention, moisture control, and power use.', { tags: ['condensation', 'ventilation', 'cold'] }),
            advanced('overnight-parking-decision', 'Compare these three overnight parking options: [details]. Rank them by legality, visibility, escape routes, lighting, weather exposure, noise, and access to services without inventing local rules.', { tags: ['parking', 'decision', 'overnight'] }),
            guide('fresh-water-sanitize', 'Make a step-by-step guide for sanitizing a [gallon]-gallon RV fresh-water system using the sanitizer strength printed on my product: [label]. Include flushing, contact time, taste/odor checks, and when not to use the system.', { tags: ['fresh water', 'sanitizing', 'tank'] }),
            advanced('van-solar-budget', 'My van has [battery capacity], [solar watts], and these daily loads: [list]. Build a cloudy-day power budget, identify the first loads to cut, and show the minimum charging needed to avoid chronic battery damage.', { tags: ['power budget', 'solar', 'loads'] }),
            advanced('rv-tire-trip-check', 'Prepare a pre-trip RV tire decision checklist using tire age, cold pressure, load, sidewall condition, temperature, and spare readiness. Tell me which findings mean do not drive rather than offering a temporary workaround.', { tags: ['tires', 'pre-trip', 'do not drive'] }),
            guide('van-breakdown-kit', 'Build a compact three-day breakdown kit for a van or RV traveling through [climate/terrain] with [people/pets]. Rank items by shelter, water, signaling, power, vehicle recovery, and medical usefulness within [space/weight].', { tags: ['breakdown kit', 'van', 'RV'] })
        ]),

        category('homestead-rural', '🏡', 'Homestead & Rural Property', 'Wells, animals, crops, septic, backup power, weather, and property resilience.', ['homestead', 'rural', 'prepper'], [
            advanced('well-pump-short-cycle', 'My well pump cycles every 20 seconds even with faucets closed. Rank the likely causes, give me non-invasive checks first, and list the signs that mean I should shut the system down.', { tags: ['well pump', 'short cycling', 'water'] }),
            advanced('chickens-heat-laying', 'Egg production dropped 70% during the week after a heat wave. Compare water intake, feed, daylight, molt, illness, and predator stress; give me checks for today and clear signs that require a veterinarian.', { tags: ['chickens', 'heat', 'eggs'] }),
            image('property-ember-entry', 'Use these exterior photos to identify likely wildfire ember-entry points around my roof, vents, deck, fence, and vegetation. Rank the fixes by cost and urgency, then outline a labeled property-hardening visual.', { tags: ['wildfire', 'property', 'embers'], followups: ['Create Visual'] }),
            image('garden-leaf-diagnosis', 'Analyze photos of these affected leaves, stems, soil surface, and nearby plants. Separate likely disease, nutrient, water, pest, and weather causes; tell me what additional photo or simple test would distinguish them.', { tags: ['garden', 'plant health', 'leaves'] }),
            advanced('preservation-crop-calendar', 'Create a month-by-month planting plan for preservation crops in growing zone [zone] with [bed space/water limits]. Prioritize reliable calories, staggered harvests, seed saving, and storage method.', { tags: ['garden calendar', 'preservation crops', 'growing zone'] }),
            advanced('septic-alarm-triage', 'My septic alarm is sounding after heavy rain. The tank was serviced [time] ago and household water use is [level]. Give me immediate water-use restrictions, safe observations, likely causes, and the signs requiring service now.', { tags: ['septic', 'alarm', 'heavy rain'] }),
            advanced('freezer-backup-plan', 'Design a backup-power and food-transfer plan for two freezers during a [hours]-hour outage using [generator/solar/battery/coolers]. Prioritize food safety, fuel, extension-cord limits, run schedule, and temperature logging.', { tags: ['freezer', 'backup power', 'food safety'] }),
            advanced('livestock-water-failure', 'The automatic livestock water system failed in [temperature] weather for [animal/count]. I have [containers/vehicle/well access]. Build an immediate manual-water plan, repair triage, and monitoring schedule.', { tags: ['livestock', 'water failure', 'heat'] }),
            advanced('greenhouse-frost-night', 'A surprise frost of [temperature/duration] is expected tonight. My greenhouse has [coverings/heat/water/thermal mass]. Rank which crops to move, cover, heat, harvest, or accept losing, and estimate the overnight workload.', { tags: ['greenhouse', 'frost', 'crops'] }),
            advanced('root-cellar-humidity', 'My root cellar is [temperature] and [humidity], with condensation on [surface] and stored [foods]. Diagnose ventilation versus moisture problems and give separate zones or containers for incompatible crops.', { tags: ['root cellar', 'humidity', 'storage'] }),
            advanced('fence-breach-pattern', 'Animals keep escaping through a fence but the obvious gate is secure. Use my description and photos of tracks, hair, bent wire, and ground disturbance to rank where and how the breach is happening.', { tags: ['fence', 'livestock', 'tracks'] }),
            guide('rural-winter-absence', 'I am leaving a rural property unattended for 30 winter days. Build a shutdown and monitoring guide for water, well, septic, heat, power, food, animals, vehicles, mail, and emergency contacts.', { tags: ['winterize', 'unattended property', '30 days'] }),
            advanced('harvest-weekend-triage', 'I have one weekend to process [harvest quantities] with [canning/dehydrating/freezing equipment]. Build a time-blocked plan that handles the most perishable food first and keeps each preservation batch within safe limits.', { tags: ['harvest', 'preservation', 'schedule'] }),
            advanced('rural-road-washout', 'The only road from my property is showing washout damage after heavy rain. Using photos, slope, drainage, vehicle type, and alternate access, help me decide whether to drive, reinforce temporarily, or stay put.', { tags: ['rural road', 'washout', 'decision'] })
        ]),

        category('vehicles-power-repair', '🔧', 'Vehicles, Power & Field Repair', 'Safe diagnostics and practical next steps for vehicles, generators, solar, tools, and improvised repairs.', ['overlander', 'van-rv', 'rural', 'camper'], [
            advanced('car-one-click', 'My car gives one loud click but will not crank. Lights are bright, I have jumper cables and a multimeter, and there is no cell service. Rank the likely causes, give me safe tests in order, and identify the point where I should stop.', { tags: ['no start', 'battery', 'starter'] }),
            video('generator-startup-video', 'Analyze this generator startup video for smoke color, unstable RPM, vibration, and unusual sound. Give me stop-now warnings first, then rank likely causes and the next safe checks.', { tags: ['generator', 'smoke', 'RPM'] }),
            image('solar-controller-photo', 'Read the solar-controller display and wiring labels visible in this photo. Explain what the values mean, flag anything abnormal, and tell me the exact close-up photo needed next. Do not ask me to touch energized conductors.', { tags: ['solar controller', 'display', 'wiring'] }),
            advanced('engine-overheat-desert', 'My engine temperature is climbing in desert heat. Coolant level was [state] before the trip, cabin heat is [state], and I see [steam/leak/no leak]. Put the safest immediate action first, then give me a stop-and-check decision tree.', { tags: ['overheating', 'desert', 'coolant'] }),
            advanced('diesel-black-smoke', 'My diesel generator is producing black smoke and losing power. Build a diagnostic flowchart beginning with load, airflow, fuel quality, and visible leaks, with stop-now conditions before any disassembly.', { tags: ['diesel', 'black smoke', 'generator'] }),
            advanced('solar-not-charging', 'My solar battery is not charging even though the controller is on. I have panel voltage, battery voltage, controller status, weather, and recent changes: [values]. Rank the likely fault location and the safest test order.', { tags: ['solar', 'not charging', 'battery'] }),
            advanced('inverter-trip-load', 'My inverter trips when [appliance] starts but runs smaller loads. Given inverter rating, battery voltage, cable length, and appliance surge rating, distinguish overload, voltage sag, connection loss, and inverter fault.', { tags: ['inverter', 'surge', 'voltage sag'] }),
            advanced('backpack-buckle-field-fix', 'A load-bearing backpack buckle broke [location] miles from the trailhead. I have cord, tape, zip ties, a spare strap, and a knife. Design a repair that transfers load without cutting circulation or damaging the pack further.', { tags: ['backpack', 'buckle', 'field repair'] }),
            image('leaking-fitting-photo', 'Use this photo of a leaking hose, fitting, or pipe to identify the connection type, likely failure point, pressure concerns, and the safest temporary containment options until the correct part is available.', { tags: ['leak', 'fitting', 'temporary repair'] }),
            image('unknown-tool-part', 'Identify this tool or mechanical part from multiple angles. Point out markings and dimensions that matter, list plausible matches, and tell me the next photo or measurement needed before I buy a replacement.', { tags: ['tool identification', 'part', 'replacement'] }),
            guide('generator-maintenance-card', 'Make a one-page generator maintenance card using my model, fuel, hours, climate, and manual intervals: [details]. Include before-start checks, run logging, load test, storage, consumables, and stop-use warnings.', { tags: ['generator', 'maintenance', 'checklist'] }),
            advanced('offgrid-power-budget', 'Calculate a conservative off-grid power plan for a refrigerator, well pump, lights, communications, and [other loads]. Show daily energy, surge loads, battery reserve, solar or generator recovery, and the first loads to shed.', { tags: ['power budget', 'well pump', 'refrigerator'], followups: ['Create Visual', 'Make Field Guide'] })
        ]),

        {
            id: 'photo-video-analysis',
            icon: '📷',
            title: 'Photo & Video Analysis',
            description: 'Let OffGrid AI inspect what you can see or record, then ask for the next best evidence.',
            audiences: ['prepper', 'homestead', 'hiker', 'camper', 'van-rv', 'rural'],
            subcategories: [
                {
                    title: 'Identify Image',
                    prompts: [
                        image('identify-with-confidence', 'Identify this plant, track, insect, or damage pattern only as far as the photo supports. Give me three visible identifying features, plausible lookalikes, your confidence, and the safest next step. Do not treat uncertainty as proof that it is safe to touch or eat.', { tags: ['identify', 'confidence', 'lookalikes'] }),
                        image('storm-roof-photo', 'Analyze these roof and exterior photos after a storm. Separate urgent water-entry or structural concerns from cosmetic damage, mark what needs a closer photo, and tell me what is unsafe to inspect myself.', { tags: ['storm damage', 'roof', 'urgent'] }),
                        image('stored-food-photo', 'Inspect this stored-food container, seal, surface, and label. Describe visible spoilage or packaging warning signs, what cannot be determined from a photo, and the safest disposition.', { tags: ['food storage', 'spoilage', 'packaging'] }),
                        image('electrical-panel-photo', 'Read the labels and visible indicators in this electrical or solar-panel photo without guessing hidden wiring. Flag heat damage, corrosion, loose covers, or mismatched labeling and tell me what requires a qualified electrician.', { tags: ['electrical', 'panel', 'labels'] }),
                        image('cloud-weather-photo', 'Analyze these cloud photos with the time, direction, wind change, temperature, and forecast I provide. Explain what the formation may indicate, uncertainty, and the field decisions I should make before weather arrives.', { tags: ['clouds', 'weather', 'forecast'] }),
                        image('animal-track-sequence', 'Compare these track photos using size reference, stride, direction, substrate, and freshness clues. Give the most likely animals, confidence, and whether the pattern changes how I should use the area.', { tags: ['tracks', 'wildlife', 'freshness'] })
                    ]
                },
                {
                    title: 'Analyze Video',
                    prompts: [
                        video('solar-shade-video', 'Analyze this walk-around video of my solar array from morning to afternoon. Identify moving shade sources, which panels are affected, and the simplest positioning or trimming questions to investigate next.', { tags: ['solar', 'shade', 'array'] }),
                        video('livestock-gait-video', 'Analyze this short video of an animal walking from the front, side, and rear. Describe visible gait asymmetry, footing or hoof clues, what cannot be diagnosed from video, and signs requiring a veterinarian.', { tags: ['livestock', 'gait', 'veterinarian'] }),
                        video('pump-cycle-video', 'Analyze this video of the pump, gauge, and sound during one full cycle. Build a timestamped sequence, identify irregular pressure or timing patterns, and tell me the next safe measurement to capture.', { tags: ['pump', 'pressure', 'cycle'] }),
                        video('vehicle-noise-video', 'Analyze this stationary vehicle video for when the noise starts, changes with RPM, and appears to originate. Separate observations from diagnosis and list stop-driving signs before suggesting checks.', { tags: ['vehicle', 'noise', 'RPM'] }),
                        video('smoke-wind-video', 'Analyze this video of smoke movement around my property using wind direction, terrain, structures, and time. Explain likely exposure paths and where people, animals, or air intakes should move first.', { tags: ['smoke', 'wind', 'property'] }),
                        video('trail-drainage-video', 'Analyze this walk-through video of a trail, driveway, or campsite after rain. Identify where water concentrates, erosion is starting, and which low-impact drainage fixes should be evaluated first.', { tags: ['drainage', 'erosion', 'rain'] })
                    ]
                }
            ]
        },

        {
            id: 'visual-field-guides',
            icon: '🎨',
            title: 'Create Visual & Field Guides',
            description: 'Turn OffGrid AI reasoning into labeled visuals, checklists, diagrams, and phone-ready guides.',
            audiences: ['prepper', 'homestead', 'hiker', 'camper', 'van-rv', 'rural'],
            subcategories: [
                {
                    title: 'Create Visual',
                    prompts: [
                        visual('rainwater-system-visual', 'My roof is 1,500 square feet, annual rainfall is 20 inches, and I want 1,000 gallons of storage. Estimate realistic collection yield and losses, recommend the main components, and prepare a simple labeled layout for Create Visual.', { tags: ['rainwater', 'system layout', 'storage'] }),
                        visual('solar-system-visual', 'Using my solar panels, controller, battery, inverter, disconnects, loads, and cable information: [details], explain the energy flow and prepare a simple labeled system overview for Create Visual. Do not invent wire sizes or code compliance.', { tags: ['solar', 'diagram', 'energy flow'] }),
                        visual('cold-wet-layering-visual', 'Build a clothing-layering plan for 20°F, wet snow, 25 mph wind, and moderate hiking effort. Explain moisture management and prepare a front-to-back labeled field card for Create Visual.', { tags: ['clothing', 'cold', 'layering'] }),
                        visual('family-camp-visual', 'Design a campsite layout for [people/pets] using my site description or photo. Separate sleeping, cooking, food, fire, sanitation, vehicle, wind, water, and exit zones, then prepare a labeled overhead visual.', { tags: ['campsite', 'layout', 'overhead'] }),
                        visual('property-evacuation-visual', 'Turn my property details, roads, gates, water points, animal areas, and hazards into an evacuation briefing. Identify primary and backup movement paths, then prepare a simple labeled property visual.', { tags: ['property', 'evacuation', 'map'] })
                    ]
                },
                {
                    title: 'Make Field Guide',
                    prompts: [
                        guide('vehicle-breakdown-guide', 'Make a phone-friendly field guide for a vehicle breakdown with no cell service. Include an immediate safety check, a no-start decision tree, signaling options, water and temperature priorities, and a one-page checklist.', { tags: ['vehicle', 'breakdown', 'no cell'] }),
                        guide('food-rotation-guide', 'Make a field guide for rotating a six-month pantry using my food list, dates, storage temperatures, family size, and cooking limits. Include monthly checks, use-first rules, pest signs, and replacement priorities.', { tags: ['pantry', 'rotation', 'six months'] }),
                        guide('family-comms-wallet-guide', 'Create a printable family communication guide with an out-of-area contact, two meeting places, school/work instructions, radio channels if used, wallet-card text, and a drill checklist.', { tags: ['family', 'communications', 'wallet card'] }),
                        guide('well-troubleshooting-guide', 'Turn my well system details into a field guide showing normal operation, safe homeowner observations, symptoms such as short cycling or no pressure, shutdown triggers, and the information a service technician will need.', { tags: ['well', 'troubleshooting', 'service'] }),
                        guide('rv-winterize-guide', 'Make a phone-friendly RV winterization and spring recommissioning guide using my plumbing layout, water heater, pump, tanks, climate, and manufacturer instructions. Separate universal checks from model-specific steps I must verify.', { tags: ['RV', 'winterize', 'spring'] })
                    ]
                }
            ]
        }
    ];

    const ownerSafetyReviewRules = [
        /amoxicillin dose for a 35-pound child/i,
        /poisoned by a household chemical/i,
        /house invasion/i,
        /\bdefen[cs]e\b/i,
        /\blooters?\b/i,
        /\briots?\b/i,
        /drug interactions? with warfarin/i,
        /patient presents with chest pain/i,
        /describe this wound and suggest treatment/i,
        /rash look like poison ivy/i,
        /cooking fire indoors or in a cave/i,
        /fire that will last all night unattended/i,
        /carry hot coals/i,
        /test if a wild plant is edible/i,
        /mushrooms? .*dangerous/i,
        /berries .*poison/i,
        /working at heights .*without fall protection/i
    ];

    window.OFFGRID_ONLINE_PROMPT_LIBRARY = {
        version: '2026-07-10.1',
        categories,
        ownerSafetyReviewRules,
        audiences: [
            { id: 'all', label: 'Everyone' },
            { id: 'emergency', label: 'Emergency' },
            { id: 'prepper', label: 'Preppers' },
            { id: 'homestead', label: 'Homesteaders' },
            { id: 'hiker', label: 'Hikers' },
            { id: 'camper', label: 'Campers' },
            { id: 'overlander', label: 'Overlanders' },
            { id: 'van-rv', label: 'Van / RV' },
            { id: 'rural', label: 'Rural Homes' }
        ]
    };
})();
