const express = require('express');
const router = express.Router();
const fs = require('fs');
const Client = require('../bin/pw-client');

router.get('/', function(req, res) {
  res.json({
    message: 'uploader service'
  })
});

router.post('/upload', function(req, res) {
  if (!req.files)
    return res.status(400).send('No files were uploaded.');

  if (req.body.key != null && req.body.key != '') {

    console.log('Starting file upload...')

    // create a new Parallel Works client
    var pw_url = "https://go.parallel.works";
    var workspace_name = "Upload Tests"; // sundat_runner_v1 in all sundat accounts

    // create the PW client
    const c = Client(pw_url, req.body.key)

    // move the form upload file somewhere for upload to PW
    let uploadedFile = req.files.uploadedFile;
    console.log(uploadedFile);
    console.log('Moving uploaded file to:', localStore);

    var localStore = './tests/' + uploadedFile.name;
    uploadedFile.mv(localStore, function(err) {
      if (err)
        return res.status(500).send(err);
      console.log('File uploaded to server. Launching PW upload...');
      // start the upload to PW
      getWorkspaceId();

    });

    // get workspace id from workspace name
    function getWorkspaceId() {
      c.get_wid(workspace_name).then(function(wid) {
        c.wid = wid;
        uploadDataset();
      });
    }

    // upload the dataset(s)
    function uploadDataset() {
      console.log("Uploading the Dataset");
      var did = c.upload_dataset(c.wid, localStore);
      did.then(function(did) {
        c.did = did;
        c.poll_upload(c.did).then(function() {
          console.log('UPLOAD COMPLETE - ID:', c.did);

          console.log('Deleting the local file...');

          fs.unlink(localStore, function() {
            res.json({
              message: 'success',
              uploaded_data_id: c.did
            });
          });

        });
      });
    }
  }
  else {
    res.json({
      "error": "please send API key"
    })
  }
})


module.exports = router;
