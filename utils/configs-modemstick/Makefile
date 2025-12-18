include $(TOPDIR)/rules.mk

PKG_NAME:=configs-modemstick
PKG_VERSION:=1.0

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=Utilities
  CATEGORY:=Utilities
  TITLE:=Tweaks for modemstick
  DEPENDS:=+PACKAGE_luci:luci-proto-modemmanager +ledcontrol +kmod-button-hotplug +inotifywait
endef

# Optional description
define Package/$(PKG_NAME)/description
	Tweaks and defaults for modemstick, including cleanup of problematic APK feeds.
endef

define Build/Configure
endef

define Build/Compile
endef

# Install configuration files and payload you already had
define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/uci_default $(1)/etc/uci-defaults

	$(INSTALL_DIR) $(1)/etc/hotplug.d/net
	$(INSTALL_DATA) ./files/hotplugs/99-wifi-led $(1)/etc/hotplug.d/net/
	
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_DATA) ./files/hotplugs/99-modem-led $(1)/etc/hotplug.d/iface/
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
set -e
FILE="/etc/apk/repositories.d/distfeeds.list"
ROOT="$${IPKG_INSTROOT:-/}"
TARGET_FILE="$$ROOT$$FILE"

if [ -f "$$TARGET_FILE" ]; then
	sed -i '\|/targets/msm89xx/msm8916/packages|d' "$$TARGET_FILE" || true
fi

exit 0
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
