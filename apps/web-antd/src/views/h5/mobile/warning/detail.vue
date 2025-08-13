<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Form, Input, Upload, Button, message } from 'ant-design-vue';
import type { UploadRequestOption as RcCustomRequestOptions } from 'ant-design-vue/es/vc-upload/interface';

import { uploadOssFile } from '#/api/oss';
import { warningEliminate } from '#/api/warning';

const route = useRoute();

const form = ref({
  warning_log_id: (route.query.id as string) || '',
  reason: '',
  description: '',
  type: '在校',
  attachments: [] as string[],
});

const fileList = ref<any[]>([]);

const customRequest = async (options: RcCustomRequestOptions) => {
  const { file, onError, onSuccess } = options;
  try {
    const resp = await uploadOssFile({
      bucket: 'test',
      namespace: 'test',
      path: '/mobile/',
      file: file as File,
      apiKey: import.meta.env.VITE_OSS_API_KEY || '',
    });
    const url = resp.url || resp.data?.url;
    if (url) {
      form.value.attachments.push(url);
    }
    onSuccess?.(resp as any);
  } catch (err) {
    onError?.(err as Error);
  }
};

const submit = async () => {
  try {
    await warningEliminate(form.value);
    message.success('提交成功');
  } catch (err) {
    message.error('提交失败');
  }
};
</script>

<template>
  <Page title="预警详情">
    <Form :model="form" layout="vertical">
      <Form.Item label="理由">
        <Input v-model:value="form.reason" />
      </Form.Item>
      <Form.Item label="描述">
        <Input.TextArea v-model:value="form.description" />
      </Form.Item>
      <Form.Item label="附件">
        <Upload
          v-model:file-list="fileList"
          :custom-request="customRequest"
          list-type="picture-card"
        >
          <Button type="dashed">上传</Button>
        </Upload>
      </Form.Item>
      <Form.Item>
        <Button type="primary" @click="submit">提交</Button>
      </Form.Item>
    </Form>
  </Page>
</template>
