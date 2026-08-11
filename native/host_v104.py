#!/usr/bin/env python3
"""Compatibility entry point for Douyin HD Pro v1.0.4.

Keeps the proven downloader implementation in host.py and adds reliable,
request-correlated open-file/open-folder responses for the Extension UI.
"""
import host as base

base.HOST_VERSION = '1.0.4'
_original_handle = base.handle


def handle_v104(msg):
    action = msg.get('action')
    request_id = msg.get('requestId')
    if action == 'open_file':
        try:
            base.open_file(msg.get('path') or '')
            base.send_message({'type':'open_result','ok':True,'action':'open_file','requestId':request_id})
        except Exception as exc:
            base.send_message({'type':'open_result','ok':False,'action':'open_file','requestId':request_id,'error':str(exc)})
        return
    if action == 'open_folder':
        try:
            base.open_folder(msg.get('path') or '')
            base.send_message({'type':'open_result','ok':True,'action':'open_folder','requestId':request_id})
        except Exception as exc:
            base.send_message({'type':'open_result','ok':False,'action':'open_folder','requestId':request_id,'error':str(exc)})
        return
    _original_handle(msg)


base.handle = handle_v104

if __name__ == '__main__':
    base.main()
