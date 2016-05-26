var sfs;
var config = {};
var roomid = "MainLobby#_@LocalVoip#_@0655795e-9916-4cfc-be1e-81f544d1d7cb#_@public";
var file = new Int8Array(64000);
var startTime = 0;
var audioCtx = new AudioContext();

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

function playPCMclip( buffer )
{
	var sampleRate = 8000;
	var audioBuffer = audioCtx.createBuffer(1, buffer.length, sampleRate);
	var source = audioCtx.createBufferSource();
	audioBuffer.getChannelData(0).set(buffer);
	source.buffer = audioBuffer;
	source.connect(audioCtx.destination);
	var delay = 0.1;
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

function playMuLawClip( data )
{
	var vcdata = new Uint8Array(data.length);
	for( i=0; i<data.length; i++ )
	{
		vcdata[i] = data[i];
	}
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
		var buffer = new Float32Array(frame.length);
		var divisor = 3267;
		for( i=0; i < frame.length; i++ )
		{
			buffer[i] = frame[i]/divisor;
		}
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

// SFS handler for Extension Response event
function onExtensionResponse( evt )
{
	setTimeout(function() { document.getElementById("speaker").style.backgroundColor = "green"; }, startTime);
	var requestType = evt.cmd;
	if( requestType == "VoipVCRequest" )
	{
		var params = evt.params;
		var userid = params["ui"];
		var data = params["VCData"];
		playMuLawClip(data);
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

function init()
{
	var host = document.getElementById("host").value;
	var port = document.getElementById("port").value;
	var zone = document.getElementById("zone").value;
	var room = document.getElementById("room").value;
	console.log(host, port, zone, room);
	connect(host, port, zone, room);
}


