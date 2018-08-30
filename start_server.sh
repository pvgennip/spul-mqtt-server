#!/bin/sh 

sudo ln -s /root/spul-mqtt-server/etc_systemd_system_spulserver /etc/systemd/system/spulserver.service

sudo systemctl enable spulserver
sudo systemctl start spulserver

exit 0