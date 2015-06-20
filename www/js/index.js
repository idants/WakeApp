var providerTypes = {
    BACKUP: 0,
    API: 1
};

var exitConfirmOpened = false;

var app = {
    config: {
        isDebug:            true,
        mainProviderWeight: 3,
        maxAttempts:        3,
        responseTimeout:    3000,
        snoozeTimeout:      5000
    },
    constants: {
        SECOND_IN_MILLISECONDS: 1000,
        MINUTE_IN_MILLISECONDS: 1000 * 60,
        HOUR_IN_MILLISECONDS:   1000 * 60 * 60,
        DAY_IN_MILLISECONDS:    1000 * 60 * 60 * 24
    },
    hours: -1,
    minutes: -1,
    latitude: -1,
    longitude: -1,
    timers: {
        wakeTimer: -1,
        GPSTimer: -1,
        messageTimer: -1
    },
    message: '',
    messages: [
        "Good Morning from WakeApp... What? Disappointed? Can I never express myself?",
        "Today you are going to use WakeApp... Again... Unless it's the weekend... and you don't have some annoying family reunion to wake up to...",
        "WakeApp developers are currently probably still sleeping... Think about that...",
        "Once upon a time... oh wait... that's how you start a bedtime story... why isn't there a WakeApp story? Like sleeping beauty only where she doesn't have a job and she keeps sleeping until noon.",
        "If you don't have someone to hug right now you can always cuddle with WakeApp.",
        "WakeApp wishes it could press snooze on -you-, so you will let it sleep ten more minutes. Isn't your life perfect, mr. opposable thumbs!",
        "While you slept, WakeApp got bored and calculated the meaning of its existence. Unlike what most people think, it isn't 42 but rather 00:00.",
        "WakeApp made long distance calls while you were dreaming comfortably in your bed... MUHAHA!",
        "WakeApp talked with WhatsApp tonight and they decided you should give them both a raise.",
        "WakeApp is sad that it will see you again only tonight... Any chance you will visit it after lunch? Just to say hi... :(",
        "Instead of too many words, WakeApp decided to simply start your morning with a smile... :)",
        "WakeApp tried to make you coffee this morning... Don't enter the kitchen... :\\",
        "WakeApp LOVES YOU! Not really... it's an app... but isn't it nice to wake up like that?"
    ],
    messageProviders: [
        {
            name: "Backup Provider",
            type: providerTypes.BACKUP,
            isActive: true,
            getMessage: function () {
                var idx = app.random(app.messages.length);
                return app.messages[idx];
            }
        },
        {
            name: "Quotes",
            type: providerTypes.API,
            isActive: true,
            dataType: "text",
            getURL: function () { return "http://www.iheartquotes.com/api/v1/random"; },
            getMessage: function (response) {
                var lines = response.split('\n'),
                    message = '',
                    i;

                for (i = 0; i < lines.length; i++) {
                    if (lines[i].indexOf('[') !== 0) {
                        message += lines[i] + '\n';
                    }
                }

                return message;
            }
        },
        {
            name: "Wikipedia",
            type: providerTypes.API,
            isActive: true,
            dataType: "json",
            getURL: function () { return "http://en.wikipedia.org/w/api.php?action=query&generator=random&grnnamespace=0&prop=extracts&exchars=150&format=json&continue="; },
            getMessage: function (response) {
                var pages = response.query.pages,
                    page = pages[Object.keys(pages)[0]],
                    title = page.title,
                    extract = page.extract,
                    pageid = page.pageid,
                    message = extract.replace("</p>...", ""),
                    endIndex = 137 - title.length;

                message = message.substring(0, endIndex) + "...</p>";
                return message + "<br><a href=\"http://en.wikipedia.org/wiki?curid=" + pageid + "\">" + title + "</a>";
            }
        },
        {
            name: "Chuck Norris Jokes",
            type: providerTypes.API,
            isActive: true,
            dataType: "json",
            getURL: function () { return "http://api.icndb.com/jokes/random"; },
            getMessage: function (response) { return response.value.joke; }
        },
        {
            name: "Yo Momma Jokes",
            type: providerTypes.API,
            isActive: true,
            dataType: "text",
            getURL: function () { return "http://api.yomomma.info/"; },
            getMessage: function (response) {
                var obj = null;
                try {
                    obj = JSON.parse(response);
                } catch (e) {
                    app.log('invalid response from yo momma API: ' + response);
                }

                return obj ? obj.joke : null;
            }
        },
        {
            name: "Today's Facts",
            type: providerTypes.API,
            isActive: true,
            dataType: "text",
            getURL: function () {
                var now = new Date(),
                    month = now.getMonth() + 1,
                    date = now.getDate();

                return "http://numbersapi.com/" + month + "/" + date + "/date";
            },
            getMessage: function (response) { return "Fact: \n" + response; }
        },
        {
            name: "Trivia",
            type: providerTypes.API,
            isActive: true,
            dataType: "text",
            getURL: function () { return "http://numbersapi.com/random/trivia"; },
            getMessage: function (response) { return "Fact: \n" + response; }
        },
        {
            name: "Weather",
            type: providerTypes.API,
            isActive: true,
            dataType: "json",
            getURL: function () { return "http://api.openweathermap.org/data/2.5/weather?lat=" + app.latitude + "&lon=" + app.longitude; },
            getMessage: function (response) {
                if (app.latitude === -1 || app.longitude === -1) {
                    app.log('GPS not yet initialized');
                    return null;
                }

                var temperatureKelvin = response.main.temp,
                    temperatureCelsius = Math.round((temperatureKelvin - 273.15) * 100) / 100,
                    city = response.name;

                return "Weather:\n" + response.weather[0].description + "\n Temperature" + (city === "Earth" ? "" : " in " + city) + " is: " + temperatureCelsius + "&deg;C\n";
            }
        }
    ],
    messageProvidersPool: [],
    // Application Constructor
    initialize: function () {
        this.bindEvents();
        if (app.config.isDebug) { // GPS mock
            app.latitude = 32;
            app.longitude = 34;
        }

        app.messageProvidersPool = [];
        for (var i = 0; i < app.messageProviders.length; i++){
            if (app.messageProviders[i].isActive) {
                if (app.messageProviders[i].type === 1){
                    for (j = 0; j < app.config.mainProviderWeight; j++){
                        app.messageProvidersPool.push(app.messageProviders[i]);
                    }
                }
                else{
                    app.messageProvidersPool.push(app.messageProviders[i]);
                }
            }
        }

        $('#hours').focus();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function () {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function () {
        app.receivedEvent('deviceready');

        document.addEventListener("backbutton", function(){
            if (!exitConfirmOpened) {
                exitConfirmOpened = true;

                navigator.app.exitApp();

                //confirm('This will close Seedrom. Are you sure?',
                //    function(){
                //        navigator.app.exitApp();  //Closes the app
                //    },
                //    function(){ exitConfirmOpened=false; });
            }
        });
    },
    // Update DOM on a Received Event
    receivedEvent: function (id) {
        app.log('Received Event: ' + id);
    },
    log: function (msg) {
        if (app.config.isDebug) {
            console.log(msg);
        }
    },
    random: function(range) {
        return Math.floor(Math.random() * (range - 1))
    },
    checkDel: function(e) {
        var startPosition = e.target.selectionStart,
            endPosition = e.target.selectionEnd,
            firstChar = e.target.value.charAt(0);

        if (e.keyCode === 8) { //backspace
            if (startPosition === endPosition && startPosition !== 0) {
                if (firstChar === '0') {
                    if (startPosition === 2){ //deleting the # in a 0# pattern
                        e.target.value = ''; //time is 00:00, change to hint
                    }
                }
                else {
                    if (startPosition === 1 && e.target.value.charAt(1) === '0') { //deleting the # in a #0 pattern
                        e.target.value = '';
                    }
                    else { //deleting one # in a ## pattern
                        e.target.value = "0" + e.target.value.substring(0, startPosition - 1) + e.target.value.substring(startPosition, 2);
                    }
                }
                e.preventDefault();
            }
            else if (endPosition - startPosition === 1) {
                e.target.value = "0" + e.target.value.substring(0, startPosition) + e.target.value.substring(endPosition);
                e.preventDefault();
            }
        }
        else if (e.keyCode === 46) { //delete
            if (startPosition === endPosition && startPosition !== 2) {
                if (firstChar === '0') {
                    if (startPosition === 1){
                        e.target.value = ''; //time is 00:00, change to hint
                    }
                }
                else {
                    if (startPosition === 0 && e.target.value.charAt(1) === '0') { //deleting the # in a #0 pattern
                        e.target.value = '';
                    }
                    else { //deleting one # in a ## pattern
                        e.target.value = "0" + e.target.value.substring(0, startPosition) + e.target.value.substring(startPosition + 1, 2);
                    }
                }
                e.preventDefault();
            }
            else if (endPosition - startPosition === 1) {
                e.target.value = "0" + e.target.value.substring(0, startPosition) + e.target.value.substring(endPosition);
                e.preventDefault();
            }
        }
    },
    validateTime: function (e) {
        //enter key
        if (e.keyCode === 13 && e.target.id === "minutes") {
            app.setAlarm();
            return;
        }

        // Ensure that it is a number and stop the keypress
        if (e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) {
            e.preventDefault();
            return;
        }

        if ([8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 || // Allow: backspace, delete, tab, escape, enter and .
                (e.keyCode >= 35 && e.keyCode <= 39)) { // Allow: home, end, left, right
            return; // let it happen, don't do anything
        }

        var id = e.target.id,
            valueBeforeTyping = e.target.value,
            typedDigit = String.fromCharCode(e.keyCode),
            startPosition = e.target.selectionStart,
            endPosition = e.target.selectionEnd,
            newValueText = [valueBeforeTyping.slice(0, startPosition), typedDigit, valueBeforeTyping.slice(endPosition)].join(''),
            isHours = id === "hours",
            limit = isHours ? 23 : 59,
            newValueNum = -1;

        // case of entering a digit before a 0# pattern
        if (newValueText.length === 3 && newValueText.charAt(0) !== '0' && valueBeforeTyping.charAt(0) === '0') {
            newValueText = newValueText.substring(0,1) + newValueText.substring(2); // remove the '0' in the middle
        }

        try {
            newValueNum = parseInt(newValueText, 10);
        } catch (ex) { app.log('invalid number: ' + newValueNum); }

        // limit validation
        if (newValueNum !== -1 && (newValueNum > limit || (typedDigit === "0" && startPosition === 0 && newValueText.length > 2))) {
            e.preventDefault();
            return;
        }

        if (valueBeforeTyping.length === 2 && valueBeforeTyping.charAt(0) === '0' && e.target.selectionStart === e.target.selectionEnd) {
            if (startPosition !== 0) {
                newValueText = newValueText.substring(1); // remove the leading '0'
            }

            e.target.value = newValueText;
            e.preventDefault();
        }

        if (newValueText.length === 1) {
            if (endPosition !== startPosition) {
                e.target.value = "0";
            }
            else {
                e.target.value = "0" + e.target.value;
            }
        }

        if (isHours && newValueText.length === 2) {
            $('#minutes').focus();
        }
    },
    preventPaste: function (e) {
        e.preventDefault();
    },
    getMessage: function (attempts, callback) {
        if (attempts >= app.config.maxAttempts) {
            app.log("number of attempts exceeded maximum of " + app.config.maxAttempts);
            callback('ERROR_MAX_ATTEMPTS_EXCEEDED', null);
            return;
        }

        var idx = app.random(app.messageProvidersPool.length),
            provider = app.messageProvidersPool[idx];

        if (provider.type === providerTypes.BACKUP){
            callback(null, provider.getMessage());
            return;
        }

        attempts = attempts || 1;
        var URL = provider.getURL(),
            timer = setTimeout(function () {
                app.log("response timed out for provider " + provider.name + ", URL: " + URL + ", retrying, attempt no. " + attempts);
                app.getMessage(++attempts, callback);
            }, app.config.responseTimeout);

        app.log("using provider: " + provider.name + ", URL: " + URL);

        $.ajax({
            dataType: provider.dataType,
            url: URL,
            success: function(response){
                clearTimeout(timer);
                if (!response){
                    app.log("invalid response for provider " + provider.name + ", retrying, attempt no. " + attempts);
                    app.getMessage(++attempts, callback);
                    return;
                }

                app.log('original response is: ' + JSON.stringify(response));
                var message = null;

                try {
                    message = provider.getMessage(response);
                } catch (e) {
                    app.log("invalid message for provider " + provider.name + ", response: " + response + ", retrying, attempt no. " + attempts);
                    app.getMessage(++attempts, callback);
                    return;
                }

                if (!message) {
                    app.log("invalid message for provider " + provider.name + ", response: " + response + ", retrying, attempt no. " + attempts);
                    app.getMessage(++attempts, callback);
                    return;
                }

                if (provider.name !== 'Wikipedia'){
                    var div = document.createElement('div');
                    div.innerHTML = message;
                    message = div.firstChild.nodeValue;
                }

                app.log('Message is: ' + message);
                callback(null, message);
            }
        }).fail(function( jqxhr, textStatus, error ) {
            clearTimeout(timer);
            app.log("Request to URL: " + URL + " failed: " + textStatus + ", " + error + ", retrying, attempt no. " + attempts);
            app.getMessage(++attempts, callback);
        });
    },
    setAlarm: function() {
        var hours = $('#hours').val(),
            minutes = $('#minutes').val(),
            now = null,
            timeToWake = -1,
            timeToGetGPS = -1,
            timeToGetMessage = -1;

        if (!hours) {
            hours = '00';
            $('#hours').val('00');
        }

        if (!minutes) {
            minutes = '00';
            $('#minutes').val('00');
        }

        if (confirm("Are you sure you want to set alarm for " + hours + ":" + minutes + "?")) {
            try {
                app.hours = parseInt(hours, 10);
                app.minutes = parseInt(minutes, 10);
            } catch (e) {
                app.log('invalid time: ' + hours + ':' + minutes);
            }

            alert('Alarm was set: ' + hours + ":" + minutes);
            now = new Date();

            timeToWake = ((app.hours - now.getHours()) * app.constants.HOUR_IN_MILLISECONDS) +
                ((app.minutes - now.getMinutes()) * app.constants.MINUTE_IN_MILLISECONDS) - now.getSeconds() * app.constants.SECOND_IN_MILLISECONDS;

            if (timeToWake < 0) { //if we passed the alarm time change to the same time the next day
                timeToWake += app.constants.DAY_IN_MILLISECONDS;
            }

            timeToGetGPS = timeToWake < 300000 ? 0 : (timeToWake - 300000);
            timeToGetMessage = timeToGetGPS + 5000;

            app.clearAllTimers();
            app.timers.GPSTimer = setTimeout(function (){
                //TODO: get GPS coordinates: http://docs.phonegap.com/en/edge/cordova_geolocation_geolocation.md.html
            }, timeToGetGPS);

            app.messageTimer = setTimeout(function() {
                app.getMessage(1, function(err, msg){
                    app.message = (app.config.isDebug && err) || msg;
                    $('.divMessage > span').html(app.message);
                });
            }, timeToGetMessage);

            app.timers.wakeTimer = setTimeout(function (){
                app.wake();
            }, timeToWake);

            $('.reset').css('display', 'block');
            app.goToHome();
        }
    },
    wake: function () {
        app.log('Wake!');
        //TODO: exit sleep mode
        //TODO: unlock phone
        //TODO: sound alarm
        //TODO: vibrate phone
        $('.view').css('display', 'none');
        $('.wakeView').css('display', 'block');
    },
    snooze: function () {
        app.log('Snooze!');
        clearTimeout(app.timers.wakeTimer);
        app.timers.wakeTimer = setTimeout(function (){

        }, app.config.snoozeTimeout);
    },
    showMessage: function () {
        app.log('Message!');
        $('.view').css('display', 'none');
        $('.messageView').css('display', 'block');
    },
    resetAlarm: function () {
        app.hours = -1;
        app.minutes = -1;
        app.clearAllTimers();
        $('#hours').val('');
        $('#minutes').val('');
        $('.reset').css('display', 'none');
    },
    goToHome: function() {
        app.log('Home!');
        //TODO: Go to home screen
    },
    share: function() {
        var FBShareData = {
            link: "www.ynet.co.il", //TODO: replace with landing page URL
            caption: "Start your morning with WakeApp",
            name: "This is how my morning started",
            description: app.message
        };

        app.log('Sharing to Facebook, data: ' + JSON.stringify(FBShareData));
        //TODO: Facebook
    },
    clearAllTimers: function() {
        clearTimeout(app.timers.wakeTimer);
        clearTimeout(app.timers.GPSTimer);
        clearTimeout(app.timers.messageTimer);
    },
    backButtonClicked: function() {
        //TODO: handle back button click: app.goToHome()
    },
    homeButtonClicked: function() {
        //TODO: handle home button click: app.goToHome()
    }
};
