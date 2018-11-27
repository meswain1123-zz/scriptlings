provider "aws" {
  access_key = "AKIAIX2ZKJMLEJ4UUEDQ"
  secret_key = "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"
  region     = "us-east-1"
}

resource "aws_elastic_beanstalk_application" "server" {
  name = "scriptlings-mini-microservice-example"
}
resource "aws_elastic_beanstalk_environment" "api" {
  name = "scriptlings-mini-env"
  application = "${aws_elastic_beanstalk_application.server.name}"
  solution_stack_name = "64bit Amazon Linux 2018.03 v2.12.5 running Docker 18.06.1-ce"

  tags = {
    Terraform = "true"
    Environment = "dev"
  }
}