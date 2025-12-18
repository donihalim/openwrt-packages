include $(TOPDIR)/rules.mk

PKG_NAME:=msm-firmware-dumper
PKG_VERSION:=1
PKG_RELEASE:=1
PKG_LICENSE:=BSD-3-Clause

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=utils
	CATEGORY:=Utilities
	TITLE:=One-shot dump of Qualcomm firmware partitions into /lib/firmware
	DEPENDS:=+kmod-fs-vfat +kmod-fs-ext4 +kmod-nls-cp437 +kmod-nls-iso8859-1
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/00-msm_firmware_dumper $(1)/etc/uci-defaults
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
