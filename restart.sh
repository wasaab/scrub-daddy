#!/bin/sh
forever stopall 
sleep 5s
if [ "$1" != "" ]; then
    if [ "$1" = "hard" ]; then
        echo performing HARD git pull
        git reset --hard HEAD
        git pull
    elif [ "$1" = "up" ]; then
        echo performing standard git pull
        git pull
    fi
    sleep 5s
fi
forever start src/bot.js