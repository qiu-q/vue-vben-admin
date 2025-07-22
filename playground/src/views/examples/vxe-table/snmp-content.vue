<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { Page } from '@vben/common-ui';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { parseSnmpContent } from '@vben/utils';

const rawData = {
  content: {
    '1.0.8802.1.1.2.1.4.1.1.7.0.28.1': 'Ethernet0/0/24',
    '1.0.8802.1.1.2.1.4.1.1.10.0.28.1': 'DeviceModel',
    '1.0.8802.1.1.2.1.4.1.1.5.0.28.1': '84:ad:58:f7:2d:1b',
  },
};

const tableData = parseSnmpContent(rawData);

const gridOptions: VxeGridProps<{
  index: number;
  key: string;
  value: string;
}> = {
  columns: [
    { field: 'value', title: 'Value' },
  ],
  data: tableData,
  height: 'auto',
};

const [Grid] = useVbenVxeGrid({
  gridOptions,
  headerSize: '2.6em',
  fontSize: '14px',
});
</script>

<template>
  <Page title="SNMP Content">
    <Grid />
  </Page>
</template>
