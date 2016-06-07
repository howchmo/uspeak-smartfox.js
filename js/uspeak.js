var sfs;
var config = {};

var startTime = 0;
var sampleSize = 256;
var userid=1;

var audioCtx = new AudioContext();

var sendingAudio = false;

navigator.getUserMedia = (
	navigator.getUserMedia ||
	navigator.webkitGetUserMedia ||
	navigator.mozGetUserMedia ||
	navigator.msGetUserMedia
);

function downsample( buffer, sampleRate, outSampleRate)
{
	if (outSampleRate == sampleRate)
	{
		return buffer;
	}
	if (outSampleRate > sampleRate)
	{
		throw "downsampling rate shall be smaller than original sample rate";
	}
	var sampleRateRatio = sampleRate / outSampleRate;
	var newLength = Math.round(buffer.length / sampleRateRatio);
	var result = new Float32Array(newLength);
	var offsetResult = 0;
	var offsetBuffer = 0;
	while (offsetResult < result.length)
	{
		var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
		var accum = 0, count = 0;
		for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++)
		{
			accum += buffer[i];
			count++;
		}
		result[offsetResult] = accum/count;
		offsetResult++;
		offsetBuffer = nextOffsetBuffer;
	}
	return result;
}

// adapted from http://stackoverflow.com/questions/35234551/javascript-converting-from-int16-to-float32
function float32ToInt16(inputArray)
{
	var output = new Int16Array(inputArray.length);
	for (var i = 0; i < inputArray.length; i++)
	{
		var s = Math.max(-1, Math.min(1, inputArray[i]));
		output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
	}
	return output;
}

function float32To16Bit(inputArray, startIndex)
{
	var output = new Uint16Array(inputArray.length-startIndex);
	for (var i = 0; i < inputArray.length; i++)
	{
		var s = Math.max(-1, Math.min(1, inputArray[i]));
		output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
	}
	return output;
}

// adapted from http://stackoverflow.com/questions/35234551/javascript-converting-from-int16-to-float32
function int16ToFloat32(inputArray)
{
	var output = new Float32Array(inputArray.length);
	for (var i = 0; i < inputArray.length; i++)
	{
		var int = inputArray[i];
		// If the high bit is on, then it is a negative number, and actually counts backwards.
		var float = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
		output[i] = float;
	}
	return output;
}


// This is a port directly from the USpeak C# source code
function MuLawDecode( mulaw )
{
	var BIAS = 0x84;
	mulaw = ~mulaw;
	var sign = mulaw & 0x80;
	var exponent = ( mulaw & 0x70 ) >> 4;
	var data = mulaw & 0x0F;
	data = data | 0x10;
	data = data << 1;
	data = data + 1;
	data = data << (exponent + 2);
	data = data - BIAS;
	if( sign == 0 )
		return data;
	else
		return -data;
}

function MuLawEncode( pcm )
{
	var BIAS = 0x84;
	var MAX = 32635;

	var sign = ( pcm & 0x8000 ) >> 8;
	if( sign != 0 )
		pcm = -pcm;
	if( pcm > MAX )
		pcm = MAX;
	pcm += BIAS;
	var exponent = 7;
	for( expMask = 0x4000; ( pcm & expMask ) == 0; exponent--, expMask >>= 1 )
	{
	}
	var mantissa = ( pcm >> ( exponent + 3 ) ) & 0x0f;
	var mulaw = ( sign | exponent << 4 | mantissa );
	return ~mulaw;
}

function playPCMclip( buffer )
{
	var sampleRate = 8000;
	var audioBuffer = audioCtx.createBuffer(1, buffer.length, sampleRate);
	var source = audioCtx.createBufferSource();
	audioBuffer.getChannelData(0).set(buffer);
	source.buffer = audioBuffer;
	source.connect(audioCtx.destination);

	var delay = 0.5;
	if( startTime == 0 || audioCtx.currentTime > startTime )
	{
		document.getElementById("speaker").style.backgroundColor = "gray";
		startTime = audioCtx.currentTime + delay;
	}
	setTimeout(function() { document.getElementById("speaker").style.backgroundColor = "green"; }, delay*1000);
	source.start(startTime);
	startTime = startTime + audioBuffer.duration;
	setTimeout(function() { document.getElementById("speaker").style.backgroundColor = "gray"; }, (delay+audioBuffer.duration)*1000);
}

function normalizeData( data )
{
	for( var i=0; i<data.length; i++ )
	{
		if( data[i] < 0 )
			data[i] = 256+data[i];
	}
	return data;
}

function playMuLawClip( data )
{
	var vcdata = data; // normalizeData(data);
	var offset = 0;
	while( offset < vcdata.length )
	{
		var len = vcdata[offset];
		var frame = new Int16Array(len);
		for( i=0; i < frame.length; i++ )
		{
			frame[i] = MuLawDecode(vcdata[offset+i+6]);
		}
		offset = offset+i+6;
		var buffer = int16ToFloat32( frame );
		playPCMclip(buffer);
	}
}

// SFS handler for connection event
function onConnection(evtParams)
{
	if (evtParams.success)
	{
		console.log("Connected to SmartFoxServer 2X!");
		sfs.send(new SFS2X.Requests.System.LoginRequest("","",config.zone));
	}
	else
		console.log("Connection failed. Is the server running at all?");
}

// SFS handler for connection lost event
function onConnectionLost( evt )
{
	alert("Connection Lost!");
}

// SFS handler for login event
function onLogin( evt )
{
	console.log("Logged In!");
	sfs.send( new SFS2X.Requests.System.JoinRoomRequest(roomid));
}

// SFS handler for login error event
function onLoginError( evt )
{
	alert("Login Error!");
}

// SFS handler for room join event
function onRoomJoin( evt )
{
	console.log("Room Joined!");
	document.getElementById("connect").innerHTML = "Joined Room: '"+roomid+"'";
}

// SFS handler for room join error event
function onRoomJoinError( evt )
{
	alert("Room Not Joined");
}

function recordData( data )
{
	var str = "";
	str += "[ ";
	str += data[0];
	for( var i=1; i<data.length; i++ )
	{
		str += ", ";
		str += data[i];
	}
	str += " ]";
	console.log(str);
}

// SFS handler for Extension Response event
function onExtensionResponse( evt )
{
	var requestType = evt.cmd;
	if( requestType == "VoipVCRequest" )
	{
		var params = evt.params;
		if( params["ui"] != userid )
		{
			var data = params["VCData"];
			//recordData(data);
			playMuLawClip(data);
		}
	}
}

// initialization function for this code, used in onload() in the HTML
function connect( host, port, zone, voipRoom )
{
	roomid = voipRoom;
	// Create configuration object
	config.host = host;
	config.port = parseInt(port);
	config.useSSL = false;
	config.zone = zone;
	config.debug = false;

	// Create SmartFox client instance
	sfs = new SmartFox(config);

	// Register for events and assign callbacks
	sfs.addEventListener(SFS2X.SFSEvent.CONNECTION, onConnection, this);
	sfs.addEventListener(SFS2X.SFSEvent.CONNECTION_LOST, onConnectionLost, this);
	sfs.addEventListener(SFS2X.SFSEvent.LOGIN_ERROR, onLoginError, this);
	sfs.addEventListener(SFS2X.SFSEvent.LOGIN, onLogin, this);
//	sfs.addEventListener(SFS2X.SFSEvent.LOGOUT, onLogout, this);
	sfs.addEventListener(SFS2X.SFSEvent.ROOM_JOIN_ERROR, onRoomJoinError, this);
	sfs.addEventListener(SFS2X.SFSEvent.ROOM_JOIN, onRoomJoin, this);
	sfs.addEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onExtensionResponse, this);

	// connect to SFS
	sfs.connect(config.host, config.port );
}

function sendSamples()
{
	console.log("sendSamples");
	for( var i=0; i<encodedSamples.length; i++ )
	{
		var params = {};
		params["ui"] = parseInt(userid);
		params["VCData"] = normalizeData(Array.prototype.slice.call(encodedSamples[i]));
		console.log(params["VCData"]);
		sfs.send(new SFS2X.Requests.System.ExtensionRequest("VoipVCRequest", params));
	}
}

function sendAudio( floats )
{
	if( sendingAudio == true )
	{
		var resampled = downsample(floats, 44100, 8000);
		var ints = float32ToInt16(resampled);
		var encoded = new Int16Array(ints.length);
		for( i=0; i<ints.length; i++ )
			encoded[i] = MuLawEncode(ints[i]);
		var data = new Int16Array(ints.length+6);
		data[0] = ints.length;
		for( var i=1; i<6; i++ )
			data[i] = 0;
		for( i=0; i<floats.length; i++ )
			data[i+6] = encoded[i];
		var params = {};
		params["ui"] = parseInt(userid);
		params["VCData"] = normalizeData(Array.prototype.slice.call(data));
		sfs.send(new SFS2X.Requests.System.ExtensionRequest("VoipVCRequest", params));
	}
}

function setupAudioNode( stream )
{
	sourceNode = audioContext.createMediaStreamSource(stream);
	javascriptNode = audioContext.createScriptProcessor(sampleSize, 1, 1);
	javascriptNode.onaudioprocess=function(e)
	{
		sendAudio( new Float32Array(e.inputBuffer.getChannelData(0)) );
	}
	sourceNode.connect(javascriptNode);
	javascriptNode.connect(audioContext.destination);
}

function onAudioError(e)
{
	console.log(e);
	alert(e);
}

function initializeMic()
{
	try
	{
		audioContext = new AudioContext();
	}
	catch(e)
	{
		alert('Web Audio API is not supported in this browser');
	}

	try
	{
		navigator.getUserMedia(
			{ video: false, audio: true},
			setupAudioNode,
			onAudioError
		);
	}
	catch (e)
	{
		alert('webkitGetUserMedia threw exception :' + e);
	}
}

function talk()
{
	sendingAudio = true;
}

function stopTalking()
{
	sendingAudio = false;
}

function init()
{
	userid = parseInt(document.getElementById("userid").value);
	var host = document.getElementById("host").value;
	var port = document.getElementById("port").value;
	var zone = document.getElementById("zone").value;
	var room = document.getElementById("room").value;
	console.log(host, port, zone, room);
	connect(host, port, zone, room);

	initializeMic();
}
