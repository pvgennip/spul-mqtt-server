#!/bin/sh 

sudo ln -s /root/spul-mqtt-server/etc_systemd_system_spulserver /etc/systemd/system/spulserver.service

systemctl enable spulserver
systemctl start spulserver

exit 0