var request = require('request');
var fs = require('fs');

var Client = function(url, key) {

    var self = this;

    this.url = url;
    this.api = url + '/api';
    this.key = key;

    this.check_if_running = function(poolname) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/resources/list?key=" + this.key + "&name=" + poolname, {
                json: true
            }, function(err, res, data) {
                if (err) {
                    return reject(err)
                }
                return resolve(data.status)
            });
        });
    }

    this.get_wid = function(name) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/histories?key=" + this.key, {
                json: true
            }, function(err, res, data) {
                for (var w = 0; w < data.length; w++) {
                    if (data[w].name == name) {
                        var wid = data[w].id;
                    }
                }
                if (wid != undefined) {
                    return resolve(wid)
                }
                else {
                    console.log('Error{ No Workspace Found...');
                    process.exit(1);
                }
            })
        })
    }

    this.upload_dataset = function(wid, filename) {
        return new Promise((resolve, reject) => {
            var r = request.post({
                url: this.api + "/tools",
                json: true,
            }, function(err, res, data) {
                if (err) {
                    return reject(err)
                }
                var did = data['outputs'][0]['id']
                return resolve(did)
            });
            var form = r.form();
            form.append('files_0|file_data', fs.createReadStream(filename));
            form.append('key', this.key);
            form.append('tool_id', 'upload1');
            form.append('workspace_id', wid);
        })
    }

    this.poll_upload = function(did) {
        console.log('Polling Upload...')
        return new Promise((resolve, reject) => {
            function getDatasetState(did) {
                this.get_dataset_state(did).then(function(state) {
                    console.log(state.toUpperCase())
                    if (state == "ok") {
                        return resolve()
                    }
                    else {
                        setTimeout(function() {
                            getDatasetState(did);
                        }, 1000);
                    }
                })
            }
            getDatasetState(did);
        })
    }

    this.get_dataset_state = function(did) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/datasets/" + did + "?key=" + this.key, {
                json: true
            }, function(err, res, data) {
                if (err) {
                    return reject(err)
                }
                return resolve(data['state'])
            })
        })
    }

    this.get_workflow_name = function(workflow) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.url + "/workflow_name/" + workflow + "?key=" + this.key, function(err, res, data) {
                if (err) {
                    return reject(err)
                }
                return resolve(data)
            })
        })
    }

    this.start_job = function(wid, did, workflow, command) {
        var inputs = {
            "inzip": {
                "values": [{
                    "src": "hda",
                    "id": did
                }]
            },
            "command": command
        };
        return new Promise((resolve, reject) => {
            this.get_workflow_name(workflow).then(function(workflowname) {
                var r = request.post({
                    url: this.api + "/tools",
                    json: true,
                }, function(err, res, data) {
                    if (err) {
                        console.log(err)
                        return reject(err)
                    }
                    var jid = data['jobs'][0]['id']
                    return resolve(jid)
                });
                var form = r.form();
                form.append('inputs', JSON.stringify(inputs));
                form.append('key', this.key);
                form.append('tool_id', workflowname);
                form.append('workspace_id', wid);
            })
        });
    };

    this.poll_job = function(jid) {

        return new Promise((resolve, reject) => {

            var lastline = 0
            var laststatus = ""

            function pollJob() {
                setTimeout(function() {
                    self.get_job_state(jid).then(function(s) {
                        var state = s[0];
                        var status = s[1];
                        if (state == undefined) {
                            state = "starting";
                            status = "";
                        }
                        if (laststatus != status) console.log(status)
                        laststatus = status;
                        if (state == "ok") {
                            self.get_result_id(jid, "results").then(function(rid) {
                                return resolve(rid)
                            })
                        }
                        else if (state == 'deleted' || state == 'error') {
                            console.log("Simulation had an error. Please try again")
                            process.exit(1);
                        }
                        else {
                            pollJob();
                        }
                    });
                }, 1000);
            }
            pollJob();
        });
    }

    this.get_job_state = function(jid) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/jobs/" + jid + "/state?key=" + this.key, {
                json: true
            }, function(err, res, data) {
                return resolve([data['state'], data['status']])
            })
        });
    }

    this.get_result_id = function(jid, name) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/jobs/" + jid + "?key=" + this.key, {
                    json: true
                },
                function(err, res, data) {
                    return resolve(data['outputs'][name]['id'])
                })
        });
    }

    this.get_download_url = function(did) {
        return new Promise((resolve, reject) => {
            var res = request.get(this.api + "/datasets/" + did + "?key=" + this.key, {
                    json: true
                },
                function(err, res, data) {
                    return resolve(self.url + data['download_url'])
                })
        });
    }
    
    return this;
}

module.exports = Client;