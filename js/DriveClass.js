"use strict";

var DriveClass = {
	
	imageList: null,
	CLIENT_ID: '788591829115-1uq193qnm8r72ujqej7l3hdj558hj7ej.apps.googleusercontent.com',
	SCOPES: ['https://www.googleapis.com/auth/drive'],
	
			  
	init: function() {
		DriveClass.imageList = document.getElementById("image-list");
		DriveClass.imageList.innerHTML = ''; // Reset list.
	},
		
	/**
	 * Check if current user has authorized this application.
	 */
	checkAuth: function() {
		gapi.auth.authorize(
			{
				'client_id': DriveClass.CLIENT_ID,
				'scope': DriveClass.SCOPES.join(' '),
				'immediate': true
		  	}, DriveClass.handleAuthResult);
	},
	
	/**
	 * Handle response from authorization server.
	 *
	 * @param {Object} authResult Authorization result.
	 */
	handleAuthResult: function(authResult) {
		if (authResult && !authResult.error) {
			document.getElementById('top-text').style.display = 'none';
		  	DriveClass.loadDriveApi();
		} else {
			document.getElementById('top-text').style.display = 'block';
		}
	},
	
	/**
	 * Load Drive API client library.
	 */
	loadDriveApi: function() {
		gapi.client.load('drive', 'v2', DriveClass.listImages);
	},
	
	/**
	 * Render images.
	 */
	listImages: function() {
		
		DriveClass.imageList.innerHTML = '';
		
		var request = gapi.client.drive.files.list({
			'maxResults': 100
		});
	
		request.execute(function(resp) {  
			var files = resp.items;
			if (files && files.length > 0) {
				
				for (var i = 0; i < files.length; i++) {
					
					var file = files[i];
				
					if (file.mimeType === 'image/png' || 
						file.mimeType === 'image/jpg' || 
						file.mimeType === 'image/jpeg') {
						
						DriveClass.renderListElement(file);
					}
				}
			  
			} else {
				var text = document.getElementById('top-text');
				text.innerHTML = "No valid images (Png, Jpg/Jpeg) found in your Google Drive";
			}
		});
	},
	  
	renderListElement: function(image) {
		  
		DriveClass.imageList.innerHTML += '<li>' + 
				/* Thumbnail frame */
				'<div class="thumbnail-frame">' +
					/* Helps thumbnail align correct */
					'<span class="helper"></span>' +
					/* Thumbnail image */
					'<img id="'+image.id+'" ' + 
					'class="thumbnail-image" ' + 
					'src="'+image.thumbnailLink+'" ' +
					'alt="'+image.originalFilename+'" ' +
					'onclick="Fullscreen.showFullScreen(\''+image.id+'\', \''+image.webContentLink+'\')" ' + 
					'title="Click to preview in fullscreen" />' +
				'</div>' +
				/* Thumbnail image-name */
				'<span class="image-name">'+image.originalFilename+'</span>' +
				/* Edit-button */
				'<a href="#" ' +
				'class="button-class button-size-small edit-button" ' +
				'onclick="DriveClass.getImageFromDrive(\''+image.id+'\', \''+image.downloadUrl+'\')">Edit</a>' +
				/* Download-button for original image */
				'<a href="'+image.webContentLink+'" download ' +
				'class="button-class button-size-small download-button">Download original</a>' +
				/* Download-button for edited image will be placed here */
				'<!-- Download-button for edited image will be added from AviaryDrive.js -->' +
				'<span id="'+image.id+'-edited"></span>' +
				/* Upload-button for edited image will be placed here */
				'<!-- Upload-button for edited image will be added from AviaryDrive.js -->' +
				'<div id="'+image.id+'-upload"></div>' +
			'</li>';
	},	
				
	getImageFromDrive: function(id, downloadURL) {
			
		if (downloadURL) {
			
			var accessToken = gapi.auth.getToken().access_token;
			var xhr = new XMLHttpRequest();
				
			xhr.onload = function() {
					
				var reader = new FileReader();
						
				reader.onloadend = function() {
					AviaryDrive.launchEditor(id, reader.result);
				};
					
				reader.readAsDataURL(xhr.response);
			};
				
			xhr.onerror = function() {
				var errorMessage = 'Error! Could not get image from Google Drive.';
				console.log(errorMessage);
				DriveClass.showErrorMessage(errorMessage);
			};
				
			xhr.open('GET', downloadURL);
			xhr.responseType = 'blob';
			xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
			xhr.send();
		}
	},
	
	// Aviary photo editor saves image temporarily on Amazon server.
	getImageFromAmazon: function(url) {
		
		var xhr = new XMLHttpRequest();
			
		xhr.onload = function() {
			DriveClass.postImageToDrive(xhr.response);
		};
			
		xhr.onerror = function() {
			console.log('Error! Could not get image from Amazon.');
			var errorMessage = 'Error! Failed to get the edited image. Therefore an upload to Google Drive could not be done.';
			DriveClass.showErrorMessage(errorMessage);	
		};
			
		xhr.open('GET', url);
		xhr.responseType = 'blob';
		xhr.send();	
	},
	
	postImageToDrive: function(fileData, callback) {
		/* Indicate image is being uploaded to Google Drive 
		and to avoid user pressing anything. */
		document.body.className = 'cursor-wait';
  		
		var boundary = '-------314159265358979323846';
		var delimiter = "\r\n--" + boundary + "\r\n";
		var close_delim = "\r\n--" + boundary + "--";
	
		var reader = new FileReader();
		reader.readAsBinaryString(fileData);
		
		reader.onload = function() {
			
			var contentType = fileData.type || 'application/octet-stream';
			var metadata = {
				'title': fileData.fileName,
				'mimeType': contentType
			};
	
			var base64Data = btoa(reader.result);
			var multipartRequestBody =
				delimiter +
				'Content-Type: application/json\r\n\r\n' +
				JSON.stringify(metadata) +
				delimiter +
				'Content-Type: ' + contentType + '\r\n' +
				'Content-Transfer-Encoding: base64\r\n' +
				'\r\n' +
				base64Data +
				close_delim;
		
			var request = gapi.client.request({
				'path': '/upload/drive/v2/files',
				'method': 'POST',
				'params': {'uploadType': 'multipart'},
				'headers': {
				  'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
				},
				'body': multipartRequestBody});
				
			if (!callback) {
      			callback = function(file) {
        			console.log(file);
					DriveClass.showSuccessMessage();
					DriveClass.listImages();
					document.body.className = 'cursor-default';
      			};
				
    		} else {
				console.log('Something went wrong! Could not post image to Google Drive.');
				var errorMessage = 'The image failed to upload to your Google Drive!';
				DriveClass.showErrorMessage(errorMessage);
				document.body.className = 'cursor-default';
			}
			
			request.execute(callback);
		};
	},
	
	showSuccessMessage: function() {
		var message = document.getElementById('success-message');
		message.className = 'success-message-show';
		
		message.innerHTML = 'The image was successfully uploaded to your Google Drive!' +
		'<img src="images/close_button_small.png" ' +
		'alt="X" ' +
		'title="Close window" ' +
		'class="close-message" ' +
		'id="close-success-message" ' +
		'onclick="DriveClass.removeSuccessMessage()" />';
	},
	
	removeSuccessMessage: function() {
		var message = document.getElementById('success-message');
		message.className += ' fadeout';
		
		setTimeout(function() {
        	message.className = 'success-message-hide';
    	}, 500);
	},
	
	showErrorMessage: function(errorMessage) {
		var message = document.getElementById('error-message');
		message.className = 'error-message-show';
		
		message.innerHTML = errorMessage + 
		'<img src="images/close_button_small.png" ' +
		'alt="X" ' +
		'title="Close window" ' +
		'class="close-message" ' +
		'id="close-error-message" ' +
		'onclick="DriveClass.removeErrorMessage()" />';
	},
	
	removeErrorMessage: function() {
		var message = document.getElementById('error-message');
		message.className += ' fadeout';
		
		setTimeout(function() {
        	message.className = 'error-message-hide';
    	}, 500);
	}
	  
};

window.onload = DriveClass.init();