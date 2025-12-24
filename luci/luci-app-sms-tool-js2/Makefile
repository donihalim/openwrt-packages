#
# Copyright 2022-2025 Rafał Wabik - IceG - From eko.one.pl forum
#
# Licensed to the GNU General Public License v3.0.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-sms-tool-js2
LUCI_TITLE:=LuCI JS Support for ModemManager
PKG_MAINTAINER:=Rafał Wabik <4Rafal@gmail.com>
LUCI_DESCRIPTION:=LuCI JS interface for ModemManager. The user interface supports SMS / AT Commands via mmcli.
LUCI_PKGARCH:=all
LUCI_DEPENDS:=+modemmanager
PKG_VERSION:=3.0.0
PKG_RELEASE:=20251220

define Package/luci-app-sms-tool-js/conffiles
/etc/config/sms_tool_js
/etc/modem/atcmmds.user
/etc/modem/phonebook.user
/etc/modem/ussdcodes.user
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
